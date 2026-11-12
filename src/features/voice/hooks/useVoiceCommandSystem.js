import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { VAD_CONFIG } from '../../../core/config/constants';
import { AppError } from '../../../core/errors/AppError';
import { MessageEntity } from '../../../domain/entities/Message';
import {
  analyzeWakeWordCall,
  detectDirectCommandIntent,
} from '../../../domain/useCases/AnalyzeWakeWordUseCase';
import { GeminiGateway } from '../../../infrastructure/ai/GeminiGateway';

/**
 * Custom Hook que gerencia o sistema de captura de áudio:
 * 1. Escuta em standby pela palavra de ativação ("Alfred") com detecção de silêncio (VAD).
 * 2. Janela armada de comando de voz após ouvir "Alfred".
 * 3. Gravação manual acionada pelo botão "Falar".
 */
export function useVoiceCommandSystem({
  isBusyRef,
  isSpeakingRef,
  stopSpeaking,
  speakText,
  speakWakeWordGreeting,
  executeCommand,
  setMessages,
  setIsLoading,
  setLoadingStage,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(true);
  const [isHandsFreeListening, setIsHandsFreeListening] = useState(false);
  const [wakeWordArmed, setWakeWordArmed] = useState(false);

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const handsFreeEnabledRef = useRef(true);
  const wakeWordArmedRef = useRef(false);
  const isManualRecordingRef = useRef(false);
  const vadIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const wakeWordWindowTimeoutRef = useRef(null);
  const startHandsFreeLoopRef = useRef(null);

  const setWakeWordArmedState = useCallback((armed) => {
    wakeWordArmedRef.current = armed;
    setWakeWordArmed(armed);
    if (wakeWordWindowTimeoutRef.current) {
      clearTimeout(wakeWordWindowTimeoutRef.current);
      wakeWordWindowTimeoutRef.current = null;
    }
    if (armed) {
      wakeWordWindowTimeoutRef.current = setTimeout(() => {
        wakeWordArmedRef.current = false;
        setWakeWordArmed(false);
      }, VAD_CONFIG.wakeWordWindowMs);
    }
  }, []);

  const clearVadInterval = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
  }, []);

  // Cronômetro visual para gravação manual
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  /**
   * Processa o arquivo de áudio capturado (seja manual, standby por "Alfred" ou janela armada).
   */
  const processCapturedAudio = useCallback(
    async (uri, { isManual = false, wasArmedWindow = false } = {}) => {
      if (!uri || isBusyRef.current) return;
      isBusyRef.current = true;

      const expectWakeWord = !isManual && !wasArmedWindow;

      if (!expectWakeWord) {
        setIsLoading(true);
        setLoadingStage('Ouvindo e transcrevendo sua voz...');
      }

      try {
        const audioFile = new File(uri);
        const base64Audio = await audioFile.base64();

        if (!base64Audio || base64Audio.length < 600) {
          setIsLoading(false);
          return;
        }

        const mimeType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a';
        const transcription = await GeminiGateway.transcribeVoiceCommand(
          base64Audio,
          mimeType
        );

        const cleanTranscription = (transcription || '').trim();
        console.log(
          '[Alfred STT] Transcrição:',
          JSON.stringify(cleanTranscription),
          '| Manual:',
          isManual,
          '| Armed:',
          wasArmedWindow
        );

        if (
          !cleanTranscription ||
          cleanTranscription.toUpperCase().includes('SILENCIO') ||
          cleanTranscription.length < 2
        ) {
          setIsLoading(false);
          if (isManual) {
            const retryMsg =
              'Não consegui captar sua voz com clareza, senhor. Poderia repetir mais próximo ao microfone?';
            setMessages((prev) => [
              ...prev,
              MessageEntity.createAssistantMessage(retryMsg),
            ]);
            await speakText(retryMsg);
          }
          return;
        }

        if (expectWakeWord) {
          const wakeAnalysis = analyzeWakeWordCall(cleanTranscription);

          if (!wakeAnalysis.called) {
            if (detectDirectCommandIntent(cleanTranscription)) {
              console.log(
                '[Alfred WakeWord] Intenção direta reconhecida:',
                cleanTranscription
              );
              await executeCommand(cleanTranscription, { lockAlreadyAcquired: true });
              return;
            }
            console.log(
              '[Alfred Standby] Áudio ignorado sem wake word:',
              cleanTranscription
            );
            return;
          }

          if (!wakeAnalysis.command) {
            setIsLoading(false);
            setWakeWordArmedState(true);

            const wakePromptText = 'Sim, senhor? Estou ouvindo.';
            setMessages((prev) => [
              ...prev,
              MessageEntity.createAssistantMessage(wakePromptText),
            ]);

            await speakWakeWordGreeting(() => {
              isBusyRef.current = false;
              if (handsFreeEnabledRef.current) {
                startHandsFreeLoopRef.current?.();
              }
            });
            return;
          }

          setWakeWordArmedState(false);
          await executeCommand(wakeAnalysis.command, { lockAlreadyAcquired: true });
          return;
        }

        setWakeWordArmedState(false);
        const wakeCheck = analyzeWakeWordCall(cleanTranscription);
        const finalCommand =
          wakeCheck.called && wakeCheck.command
            ? wakeCheck.command
            : cleanTranscription;

        await executeCommand(finalCommand, { lockAlreadyAcquired: true });
      } catch (error) {
        console.log('Erro ao processar áudio:', error);
        setIsLoading(false);

        if (!expectWakeWord) {
          const isQuota = AppError.isQuotaExceeded(error);
          const errorMessage = isQuota
            ? 'Senhor, o limite gratuito de chamadas da API Gemini foi atingido neste minuto. Aguarde alguns segundos e fale novamente.'
            : 'Perdão, senhor. Tive dificuldade em processar o áudio neste instante. Pode tentar novamente?';

          setMessages((prev) => [
            ...prev,
            MessageEntity.createAssistantMessage(errorMessage),
          ]);
          await speakText(errorMessage);
        }
      } finally {
        isBusyRef.current = false;
        if (
          handsFreeEnabledRef.current &&
          !isSpeakingRef.current &&
          !isManualRecordingRef.current
        ) {
          setTimeout(() => {
            startHandsFreeLoopRef.current?.();
          }, 300);
        }
      }
    },
    [
      executeCommand,
      isBusyRef,
      isSpeakingRef,
      setIsLoading,
      setLoadingStage,
      setMessages,
      setWakeWordArmedState,
      speakText,
      speakWakeWordGreeting,
    ]
  );

  /**
   * Inicia o monitoramento automático em segundo plano (Standby para "Alfred" ou janela armada).
   */
  const startHandsFreeMonitoring = useCallback(async () => {
    if (
      !handsFreeEnabledRef.current ||
      isBusyRef.current ||
      isSpeakingRef.current ||
      isManualRecordingRef.current
    ) {
      return;
    }

    clearVadInterval();

    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      setIsHandsFreeListening(true);

      let speechDetected = false;
      let speechStartTime = 0;
      let lastVoiceTime = Date.now();
      const sessionStartTime = Date.now();

      vadIntervalRef.current = setInterval(async () => {
        if (
          !handsFreeEnabledRef.current ||
          isBusyRef.current ||
          isSpeakingRef.current ||
          isManualRecordingRef.current
        ) {
          clearVadInterval();
          setIsHandsFreeListening(false);
          return;
        }

        const recorderState = audioRecorder.getStatus();
        if (!recorderState.isRecording) return;

        const now = Date.now();
        const metering =
          typeof recorderState.metering === 'number' ? recorderState.metering : -160;
        const threshold = wakeWordArmedRef.current
          ? VAD_CONFIG.armedSpeechDbThreshold
          : VAD_CONFIG.standbySpeechDbThreshold;

        if (metering > threshold) {
          if (!speechDetected) {
            speechDetected = true;
            speechStartTime = now;
          }
          lastVoiceTime = now;
        }

        const silenceElapsed = now - lastVoiceTime;
        const speechDuration = speechDetected ? now - speechStartTime : 0;

        if (
          speechDetected &&
          speechDuration >= VAD_CONFIG.minSpeechDurationMs &&
          (silenceElapsed >= VAD_CONFIG.silenceDurationToCommitMs ||
            speechDuration >= VAD_CONFIG.maxSingleUtteranceMs)
        ) {
          clearVadInterval();
          setIsHandsFreeListening(false);
          const wasArmed = wakeWordArmedRef.current;

          try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;
            if (uri) {
              await processCapturedAudio(uri, {
                isManual: false,
                wasArmedWindow: wasArmed,
              });
            }
          } catch (stopError) {
            console.log('Erro ao finalizar captura hands-free:', stopError);
            startHandsFreeLoopRef.current?.();
          }
          return;
        }

        // Recicla o buffer se ninguém falou por 20 segundos em standby
        if (!speechDetected && now - sessionStartTime > VAD_CONFIG.sessionRecycleMs) {
          clearVadInterval();
          try {
            await audioRecorder.stop();
          } catch {}
          startHandsFreeLoopRef.current?.();
        }
      }, VAD_CONFIG.pollingIntervalMs);
    } catch (error) {
      console.log('Aviso ao iniciar monitoramento hands-free:', error);
      setIsHandsFreeListening(false);
    }
  }, [
    audioRecorder,
    clearVadInterval,
    isBusyRef,
    isSpeakingRef,
    processCapturedAudio,
  ]);

  useEffect(() => {
    startHandsFreeLoopRef.current = startHandsFreeMonitoring;
  }, [startHandsFreeMonitoring]);

  useEffect(() => {
    const bootTimer = setTimeout(() => {
      if (handsFreeEnabledRef.current) {
        startHandsFreeMonitoring();
      }
    }, 1000);

    return () => {
      clearTimeout(bootTimer);
      clearVadInterval();
      if (wakeWordWindowTimeoutRef.current) {
        clearTimeout(wakeWordWindowTimeoutRef.current);
      }
    };
  }, [clearVadInterval, startHandsFreeMonitoring]);

  /**
   * Alterna o modo de escuta ativa por palavra de ativação ("Alfred").
   */
  const toggleHandsFree = useCallback(async () => {
    const nextValue = !handsFreeEnabledRef.current;
    handsFreeEnabledRef.current = nextValue;
    setHandsFreeEnabled(nextValue);

    if (!nextValue) {
      clearVadInterval();
      setWakeWordArmedState(false);
      setIsHandsFreeListening(false);
      try {
        await audioRecorder.stop();
      } catch {}
    } else {
      startHandsFreeMonitoring();
    }
  }, [audioRecorder, clearVadInterval, setWakeWordArmedState, startHandsFreeMonitoring]);

  /**
   * Inicia gravação manual imediata quando o usuário toca no botão "Falar".
   */
  const startManualRecording = useCallback(async () => {
    try {
      clearVadInterval();
      setIsHandsFreeListening(false);
      isManualRecordingRef.current = true;
      await stopSpeaking();

      try {
        await audioRecorder.stop();
      } catch {}

      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        isManualRecordingRef.current = false;
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      isManualRecordingRef.current = false;
      console.error('Erro ao iniciar gravação manual:', error);
    }
  }, [audioRecorder, clearVadInterval, stopSpeaking]);

  /**
   * Finaliza a gravação manual e envia diretamente para transcrição e resposta.
   */
  const stopManualRecording = useCallback(async () => {
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      isManualRecordingRef.current = false;
      if (uri) {
        await processCapturedAudio(uri, {
          isManual: true,
          wasArmedWindow: true,
        });
      }
    } catch (error) {
      isManualRecordingRef.current = false;
      console.error('Erro ao parar gravação manual:', error);
      if (handsFreeEnabledRef.current) {
        startHandsFreeMonitoring();
      }
    }
  }, [audioRecorder, processCapturedAudio, startHandsFreeMonitoring]);

  return {
    isRecording,
    recordingSeconds,
    handsFreeEnabled,
    isHandsFreeListening,
    wakeWordArmed,
    startHandsFreeMonitoring,
    toggleHandsFree,
    startManualRecording,
    stopManualRecording,
  };
}

