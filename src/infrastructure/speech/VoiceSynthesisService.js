import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { GEMINI_API_KEY } from '../../../config';
import {
  ENDPOINTS,
  MODELOS_TTS_GEMINI,
  VOICE_CONFIG,
} from '../../core/config/constants';
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
      const uri = await this.synthesizeSpeechFile(
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

  async synthesizeGeminiMaleTts(text, messageId) {
    const payloadBody = {
      contents: [
        {
          parts: [
            {
              text,
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
    };

    const availableModels = MODELOS_TTS_GEMINI.filter(
      (m) => !GeminiGateway.isModelExhausted(m)
    );
    const modelsToTry =
      availableModels.length > 0 ? availableModels : [MODELOS_TTS_GEMINI[0]];

    for (const ttsModel of modelsToTry) {
      try {
        let data = null;

        if (GEMINI_API_KEY) {
          try {
            const url = `${ENDPOINTS.geminiBaseUrl}/${ttsModel}:generateContent?key=${GEMINI_API_KEY}`;
            const response = await fetchWithTimeout(
              url,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadBody),
              },
              25000
            );
            data = await response.json();
          } catch (_) {
            const proxyResp = await fetchWithTimeout(
              ENDPOINTS.metroGemini,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: ttsModel,
                  apiKey: GEMINI_API_KEY,
                  body: payloadBody,
                }),
              },
              25000
            );
            data = await proxyResp.json();
          }
        } else {
          const proxyResp = await fetchWithTimeout(
            ENDPOINTS.metroGemini,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: ttsModel, body: payloadBody }),
            },
            25000
          );
          data = await proxyResp.json();
        }

        if (
          data?.error &&
          AppError.isQuotaExceeded(data.error?.message, data.error?.status)
        ) {
          // Não bloqueia definitivamente o modelo principal de TTS para evitar queda em voz robótica por limite momentâneo de RPM
          if (ttsModel !== MODELOS_TTS_GEMINI[0]) {
            GeminiGateway.markModelExhausted(ttsModel);
          }
          continue;
        }

        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          const wavBase64 = inlineData.mimeType?.includes('wav')
            ? inlineData.data
            : pcmBase64ToWavBase64(inlineData.data, 24000);
          if (!FileSystem.cacheDirectory) {
            const dataUri = `data:audio/wav;base64,${wavBase64}`;
            this.audioCache[messageId] = dataUri;
            return dataUri;
          }
          const fileUri = `${FileSystem.cacheDirectory}alfred_voz_${messageId}.wav`;
          await FileSystem.writeAsStringAsync(fileUri, wavBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          this.audioCache[messageId] = fileUri;
          return fileUri;
        }
      } catch (err) {
        console.warn(
          `[VoiceSynthesisService] Gemini TTS (${ttsModel}) falhou:`,
          err.message
        );
      }
    }

    return null;
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

    // 1. Motor principal ilimitado e natural: Voz Neural Masculina AntonioNeural (pt-BR-AntonioNeural)
    const uriNeural = await sintetizarVozMasculinaUnica(text, messageId);
    if (uriNeural) {
      this.audioCache[messageId] = uriNeural;
      if (text === VOICE_CONFIG.defaultWakeGreeting) {
        this.audioCache['wake_greeting'] = uriNeural;
      }
      return uriNeural;
    }

    // 2. Contingência secundária: Voz Neural Masculina Charon (Gemini TTS)
    const uriGemini = await this.synthesizeGeminiMaleTts(text, messageId);
    if (uriGemini) {
      this.audioCache[messageId] = uriGemini;
      if (text === VOICE_CONFIG.defaultWakeGreeting) {
        this.audioCache['wake_greeting'] = uriGemini;
      }
      return uriGemini;
    }

    return null;
  }

  async playLocalAudioFile(fileUri, onFinishCallback) {
    await this.stopSpeaking();
    this.setSpeakingState(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.Audio !== 'undefined') {
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
          const audio = new window.Audio(fileUri);
          this.activePlayer = {
            pause: () => audio.pause(),
            remove: () => {
              audio.src = '';
            },
          };
          const safetyTimer = setTimeout(complete, 120000);
          audio.onended = () => {
            clearTimeout(safetyTimer);
            complete();
          };
          audio.onerror = () => {
            clearTimeout(safetyTimer);
            complete();
          };
          audio.play().catch(() => {
            clearTimeout(safetyTimer);
            complete();
          });
        } catch (_) {
          complete();
        }
      });
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch (_) {}

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
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch (_) {}

    let voices = [];
    try {
      voices = await Speech.getAvailableVoicesAsync();
    } catch (_) {}

    const ptVoices = voices.filter((v) =>
      v.language?.toLowerCase().startsWith('pt')
    );
    const maleVoice =
      ptVoices.find((v) => {
        const n = `${v.name || ''} ${v.identifier || ''}`.toLowerCase();
        return n.includes('antonio') && n.includes('natural');
      }) ||
      ptVoices.find((v) => {
        const n = `${v.name || ''} ${v.identifier || ''}`.toLowerCase();
        return (
          n.includes('antonio') ||
          n.includes('felipe') ||
          n.includes('daniel') ||
          n.includes('joaquim')
        );
      });

    return new Promise((resolve) => {
      const done = () => {
        this.setSpeakingState(false);
        onFinishCallback?.();
        resolve();
      };
      Speech.speak(text, {
        language: 'pt-BR',
        voice: maleVoice?.identifier,
        pitch: maleVoice ? 0.96 : 0.94,
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
