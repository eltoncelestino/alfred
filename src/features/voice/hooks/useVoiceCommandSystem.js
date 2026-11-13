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
  const isStartingMonitorRef = useRef(false);
  const vadIntervalRef = useRef(null);
  const webRecognitionRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const wakeWordWindowTimeoutRef = useRef(null);
  const startHandsFreeLoopRef = useRef(null);

  const stopWebRecognition = useCallback(() => {
    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.onend = null;
        webRecognitionRef.current.onresult = null;
        webRecognitionRef.current.onerror = null;
        webRecognitionRef.current.stop();
      } catch (_) {}
      webRecognitionRef.current = null;
    }
  }, []);

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
   * Roteia uma transcrição de voz já reconhecida (Wake-Word em standby, janela armada ou comando manual).
   */
  const handleTranscribedText = useCallback(
    async (cleanTranscription, { isManual = false, wasArmedWindow = false } = {}) => {
      const expectWakeWord = !isManual && !wasArmedWindow;

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

          await speakWakeWordGreeting();
          return;
        }

        setWakeWordArmedState(false);
        await executeCommand(wakeAnalysis.command, { lockAlreadyAcquired: true });
        return;
      }

      const wakeCheck = analyzeWakeWordCall(cleanTranscription);
      if (wasArmedWindow && wakeCheck.called && !wakeCheck.command) {
        // Usuário apenas repetiu "Alfred" durante a janela armada: mantém o microfone armado
        setIsLoading(false);
        setWakeWordArmedState(true);
        return;
      }

      setWakeWordArmedState(false);
      const finalCommand =
        wakeCheck.called && wakeCheck.command
          ? wakeCheck.command
          : cleanTranscription;

      await executeCommand(finalCommand, { lockAlreadyAcquired: true });
    },
    [
      executeCommand,
      setIsLoading,
      setMessages,
      setWakeWordArmedState,
      speakWakeWordGreeting,
    ]
  );

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
        let base64Audio = '';
        let mimeType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a';

        if (Platform.OS === 'web') {
          const blobResp = await fetch(uri);
          const blob = await blobResp.blob();
          if (blob.type) {
            mimeType = blob.type.split(';')[0] || 'audio/webm';
          } else {
            mimeType = 'audio/webm';
          }
          base64Audio = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = String(reader.result || '');
              const commaIndex = dataUrl.indexOf(',');
              resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          const audioFile = new File(uri);
          base64Audio = await audioFile.base64();
        }

        if (!base64Audio || base64Audio.length < 200) {
          setIsLoading(false);
          return;
        }

        const transcription = await GeminiGateway.transcribeVoiceCommand(
          base64Audio,
          mimeType,
          { expectWakeWord }
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

        await handleTranscribedText(cleanTranscription, {
          isManual,
          wasArmedWindow,
        });
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
      handleTranscribedText,
      isBusyRef,
      isSpeakingRef,
      setIsLoading,
      setLoadingStage,
      setMessages,
      speakText,
    ]
  );

  /**
   * Inicia o monitoramento automático em segundo plano (Standby para "Alfred" ou janela armada).
   */
  const startHandsFreeMonitoring = useCallback(async () => {
    if (
      isStartingMonitorRef.current ||
      !handsFreeEnabledRef.current ||
      isBusyRef.current ||
      isSpeakingRef.current ||
      isManualRecordingRef.current
    ) {
      return;
    }

    if (Platform.OS === 'web') {
      const SpeechRec =
        typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!SpeechRec) {
        setIsHandsFreeListening(false);
        return;
      }

      if (webRecognitionRef.current) {
        return;
      }

      isStartingMonitorRef.current = true;
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsHandsFreeListening(true);
        };

        recognition.onresult = async (event) => {
          if (
            isBusyRef.current ||
            isSpeakingRef.current ||
            isManualRecordingRef.current
          ) {
            return;
          }
          const lastIdx = event.results.length - 1;
          const result = event.results[lastIdx];
          if (!result || !result.isFinal) return;

          const transcript = String(result[0]?.transcript || '').trim();
          if (!transcript || transcript.length < 2) return;

          const wasArmed = wakeWordArmedRef.current;
          console.log(
            '[Alfred Web Speech] Transcrição:',
            JSON.stringify(transcript),
            '| Armed:',
            wasArmed
          );

          stopWebRecognition();
          setIsHandsFreeListening(false);
          isBusyRef.current = true;

          try {
            await handleTranscribedText(transcript, {
              isManual: false,
              wasArmedWindow: wasArmed,
            });
          } finally {
            isBusyRef.current = false;
            if (
              handsFreeEnabledRef.current &&
              !isSpeakingRef.current &&
              !isManualRecordingRef.current
            ) {
              setTimeout(() => {
                startHandsFreeLoopRef.current?.();
              }, 350);
            }
          }
        };

        recognition.onerror = (evt) => {
          const err = evt?.error;
          setIsHandsFreeListening(false);
          stopWebRecognition();
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            return;
          }
          if (
            handsFreeEnabledRef.current &&
            !isBusyRef.current &&
            !isSpeakingRef.current &&
            !isManualRecordingRef.current
          ) {
            setTimeout(() => {
              startHandsFreeLoopRef.current?.();
            }, 800);
          }
        };

        recognition.onend = () => {
          setIsHandsFreeListening(false);
          webRecognitionRef.current = null;
          if (
            handsFreeEnabledRef.current &&
            !isBusyRef.current &&
            !isSpeakingRef.current &&
            !isManualRecordingRef.current
          ) {
            setTimeout(() => {
              startHandsFreeLoopRef.current?.();
            }, 350);
          }
        };

        webRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.log('Aviso ao iniciar escuta contínua no navegador:', err);
        stopWebRecognition();
        setIsHandsFreeListening(false);
      } finally {
        isStartingMonitorRef.current = false;
      }
      return;
    }

    isStartingMonitorRef.current = true;
    clearVadInterval();

    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      try {
        await audioRecorder.stop();
      } catch {}

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
          try {
            await audioRecorder.stop();
          } catch {}
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
        const silenceLimitMs = wakeWordArmedRef.current
          ? VAD_CONFIG.armedSilenceDurationToCommitMs
          : VAD_CONFIG.silenceDurationToCommitMs;

        if (
          speechDetected &&
          speechDuration >= VAD_CONFIG.minSpeechDurationMs &&
          (silenceElapsed >= silenceLimitMs ||
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
    } finally {
      isStartingMonitorRef.current = false;
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
      stopWebRecognition();
      if (wakeWordWindowTimeoutRef.current) {
        clearTimeout(wakeWordWindowTimeoutRef.current);
      }
    };
  }, [clearVadInterval, startHandsFreeMonitoring, stopWebRecognition]);

  /**
   * Alterna o modo de escuta ativa por palavra de ativação ("Alfred").
   */
  const toggleHandsFree = useCallback(async () => {
    const nextValue = !handsFreeEnabledRef.current;
    handsFreeEnabledRef.current = nextValue;
    setHandsFreeEnabled(nextValue);

    if (!nextValue) {
      clearVadInterval();
      stopWebRecognition();
      setWakeWordArmedState(false);
      setIsHandsFreeListening(false);
      try {
        await audioRecorder.stop();
      } catch {}
    } else {
      startHandsFreeMonitoring();
    }
  }, [
    audioRecorder,
    clearVadInterval,
    setWakeWordArmedState,
    startHandsFreeMonitoring,
    stopWebRecognition,
  ]);

  /**
   * Inicia gravação manual imediata quando o usuário toca no botão "Falar".
   */
  const startManualRecording = useCallback(async () => {
    try {
      clearVadInterval();
      stopWebRecognition();
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

  const armFollowUpWindow = useCallback(() => {
    if (handsFreeEnabledRef.current) {
      setWakeWordArmedState(true);
    }
  }, [setWakeWordArmedState]);

  return {
    isRecording,
    recordingSeconds,
    handsFreeEnabled,
    isHandsFreeListening,
    wakeWordArmed,
    armFollowUpWindow,
    startHandsFreeMonitoring,
    toggleHandsFree,
    startManualRecording,
    stopManualRecording,
  };
}

