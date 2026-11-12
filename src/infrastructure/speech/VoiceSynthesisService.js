import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { GEMINI_API_KEY } from '../../../config';
import { ENDPOINTS, VOICE_CONFIG } from '../../core/config/constants';
import { AppError } from '../../core/errors/AppError';
import { pcmBase64ToWavBase64 } from '../../utils/wavEncoder';
import { GeminiGateway } from '../ai/GeminiGateway';
import { fetchWithTimeout } from '../http/httpClient';
import { sintetizarVozMasculinaUnica } from './NeuralTtsEngine';

/**
 * Facade Pattern: Centraliza cache de áudio, síntese neural masculina única,
 * reprodução nativa via expo-audio e contingência masculina via expo-speech.
 */
export class VoiceSynthesisService {
  constructor({ onSpeakingStateChange } = {}) {
    this.audioCache = {};
    this.activePlayer = null;
    this.onSpeakingStateChange = onSpeakingStateChange;
  }

  setSpeakingState(isSpeaking) {
    this.onSpeakingStateChange?.(Boolean(isSpeaking));
  }

  async prewarmWakeGreeting() {
    return this.warmUpWakeGreeting();
  }

  async warmUpWakeGreeting() {
    try {
      const uri = await sintetizarVozMasculinaUnica(
        VOICE_CONFIG.defaultWakeGreeting,
        'wake_greeting'
      );
      if (uri) {
        this.audioCache['wake_greeting'] = uri;
      }
    } catch (_) {}
  }

  async stopActivePlayback() {
    return this.stopSpeaking();
  }

  async stopSpeaking() {
    this.setSpeakingState(false);
    try {
      await Speech.stop();
    } catch (_) {}

    if (this.activePlayer) {
      try {
        this.activePlayer.pause();
        this.activePlayer.remove();
      } catch (_) {}
      this.activePlayer = null;
    }
  }

  async synthesizeSpeechFile(text, messageId) {
    if (
      text === VOICE_CONFIG.defaultWakeGreeting &&
      this.audioCache['wake_greeting']
    ) {
      this.audioCache[messageId] = this.audioCache['wake_greeting'];
      return this.audioCache['wake_greeting'];
    }

    if (this.audioCache[messageId]) {
      return this.audioCache[messageId];
    }

    // 1. Motor principal: Voz Neural Masculina Fixa (pt-BR-AntonioNeural)
    const uriNeural = await sintetizarVozMasculinaUnica(text, messageId);
    if (uriNeural) {
      this.audioCache[messageId] = uriNeural;
      if (text === VOICE_CONFIG.defaultWakeGreeting) {
        this.audioCache['wake_greeting'] = uriNeural;
      }
      return uriNeural;
    }

    // 2. Fallback secundário: Voz Neural Masculina Charon (Gemini TTS)
    const ttsModel = 'gemini-2.5-flash-preview-tts';
    if (GEMINI_API_KEY && !GeminiGateway.isModelExhausted(ttsModel)) {
      try {
        const url = `${ENDPOINTS.geminiBaseUrl}/${ttsModel}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Leia com uma única voz masculina grave, serena e natural em português do Brasil, mantendo exatamente o mesmo locutor do início ao fim: ${text}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: VOICE_CONFIG.geminiFallbackVoice,
                    },
                  },
                },
              },
            }),
          },
          10000
        );

        const data = await response.json();
        if (
          AppError.isQuotaExceeded(data.error?.message, data.error?.status)
        ) {
          GeminiGateway.markModelExhausted(ttsModel);
        }

        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          const wavBase64 = inlineData.mimeType?.includes('wav')
            ? inlineData.data
            : pcmBase64ToWavBase64(inlineData.data, 24000);
          const fileUri = `${FileSystem.cacheDirectory}alfred_voz_${messageId}.wav`;
          await FileSystem.writeAsStringAsync(fileUri, wavBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          this.audioCache[messageId] = fileUri;
          return fileUri;
        }
      } catch (err) {
        console.warn('[VoiceSynthesisService] Fallback Gemini TTS falhou:', err.message);
      }
    }

    return null;
  }

  async playLocalAudioFile(fileUri, onFinishCallback) {
    await this.stopSpeaking();
    this.setSpeakingState(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });

    return new Promise((resolve) => {
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        this.setSpeakingState(false);
        onFinishCallback?.();
        resolve();
      };

      try {
        const player = createAudioPlayer({ uri: fileUri });
        this.activePlayer = player;

        const safetyTimer = setTimeout(complete, 45000);

        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish || status.error) {
            clearTimeout(safetyTimer);
            try {
              player.remove();
            } catch (_) {}
            if (this.activePlayer === player) {
              this.activePlayer = null;
            }
            complete();
          }
        });

        player.play();
      } catch (_) {
        complete();
      }
    });
  }

  async speakEmergencyMaleFallback(text, onFinishCallback) {
    this.setSpeakingState(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });

    const voices = await Speech.getAvailableVoicesAsync();
    const maleVoice = voices.find(
      (v) =>
        v.language?.toLowerCase().startsWith('pt') &&
        (v.name?.toLowerCase().includes('felipe') ||
          v.identifier?.toLowerCase().includes('felipe') ||
          v.name?.toLowerCase().includes('daniel') ||
          v.name?.toLowerCase().includes('joaquim'))
    );

    return new Promise((resolve) => {
      const done = () => {
        this.setSpeakingState(false);
        onFinishCallback?.();
        resolve();
      };
      Speech.speak(text, {
        language: 'pt-BR',
        voice: maleVoice?.identifier,
        pitch: maleVoice ? 0.92 : 0.76,
        rate: 0.98,
        onDone: done,
        onStopped: done,
        onError: done,
      });
    });
  }

  async speak(text, onFinishCallback) {
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      onFinishCallback?.();
      return;
    }

    const msgId = `tts_${Date.now()}`;
    const fileUri = await this.synthesizeSpeechFile(cleanText, msgId);
    if (fileUri) {
      await this.playLocalAudioFile(fileUri, onFinishCallback);
      return;
    }

    await this.speakEmergencyMaleFallback(cleanText, onFinishCallback);
  }

  async speakWakeWordGreeting(onFinishCallback) {
    return this.speak(VOICE_CONFIG.defaultWakeGreeting, onFinishCallback);
  }
}
