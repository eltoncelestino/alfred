import { GEMINI_API_KEY } from '../../../config';
import {
  ENDPOINTS,
  INITIAL_EXHAUSTED_MODELS,
  MODELOS_AUDIO_GEMINI,
  MODELOS_TEXTO_GEMINI,
} from '../../core/config/constants';
import { AppError } from '../../core/errors/AppError';
import { PROMPT_ALFRED } from '../../domain/prompts/alfredPersona';
import { fetchWithTimeout } from '../http/httpClient';

// Disjuntor de cota em memória compartilhado pela sessão
const quotaExhaustedModels = new Set(INITIAL_EXHAUSTED_MODELS);

/**
 * Strategy Adapter: Adapta o payload da conversa conforme a família do modelo
 * (Gemini 3.x/4 suporta system_instruction nativo; Gemma 4 recebe instrução inline).
 */
function buildModelRequestBody(modelName, promptOrHistory) {
  const historyArray = Array.isArray(promptOrHistory)
    ? promptOrHistory
    : [{ role: 'user', text: String(promptOrHistory || '') }];

  const formattedContents = historyArray.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: msg.parts || [{ text: msg.text }],
  }));

  if (modelName.startsWith('gemma-')) {
    const gemmaContents = formattedContents.map((item, index) => {
      if (index === 0 && item.role === 'user') {
        const originalText = item.parts?.[0]?.text || '';
        return {
          role: 'user',
          parts: [{ text: `${PROMPT_ALFRED}\n\n${originalText}` }],
        };
      }
      return item;
    });
    return { contents: gemmaContents };
  }

  return {
    system_instruction: { parts: [{ text: PROMPT_ALFRED }] },
    contents: formattedContents,
  };
}

/**
 * Gateway centralizado de Inteligência Artificial (Conversação e Transcrição Multimodal).
 */
export const GeminiGateway = {
  isModelExhausted(modelName) {
    return quotaExhaustedModels.has(modelName);
  },

  markModelExhausted(modelName) {
    quotaExhaustedModels.add(modelName);
  },

  async generateAssistantReply(promptOrHistory) {
    let lastError = null;

    // Se todos os modelos tiverem sido marcados anteriormente, limpa o cache para tentar de novo
    const availableModels = MODELOS_TEXTO_GEMINI.filter(
      (m) => !quotaExhaustedModels.has(m)
    );
    const modelsToTry =
      availableModels.length > 0 ? availableModels : MODELOS_TEXTO_GEMINI;

    for (const model of modelsToTry) {
      try {
        const body = buildModelRequestBody(model, promptOrHistory);
        const url = `${ENDPOINTS.geminiBaseUrl}/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          20000
        );

        const data = await response.json();

        if (data.error) {
          const errMsg = data.error.message || 'Erro na API do Gemini';
          if (AppError.isQuotaExceeded(errMsg, data.error.status)) {
            quotaExhaustedModels.add(model);
          }
          throw new AppError(`[${model}] ${errMsg}`, data.error.status);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text.trim();
        }
      } catch (error) {
        lastError = error;
        console.warn(
          `[GeminiGateway] Modelo ${model} falhou, alternando para o próximo:`,
          error.message
        );
      }
    }

    console.error('[GeminiGateway] Todos os modelos falharam:', lastError);
    if (lastError && AppError.isQuotaExceeded(lastError.message)) {
      throw lastError;
    }
    return 'Perdão, tive uma oscilação momentânea na conexão. Poderia repetir?';
  },

  async transcribeVoiceCommand(base64Audio, mimeType = 'audio/mp4') {
    const availableModels = MODELOS_AUDIO_GEMINI.filter(
      (m) => !quotaExhaustedModels.has(m)
    );
    const modelsToTry =
      availableModels.length > 0 ? availableModels : MODELOS_AUDIO_GEMINI;

    for (const model of modelsToTry) {
      try {
        const url = `${ENDPOINTS.geminiBaseUrl}/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Audio,
                      },
                    },
                    {
                      text: 'O usuário está falando em português com seu assistente chamado "Alfred". Transcreva exatamente o que foi dito neste áudio em português. IMPORTANTE: se o som parecer alguém chamando "Alfred" (mesmo que soe parecido com "Alfredo", "Fred", "Ao Fred", "O Fred" ou "Afraid"), transcreva como "Alfred". Se houver apenas ruído ambiente, respiração ou silêncio sem fala humana inteligível, responda apenas: [SILENCIO]. Retorne somente o texto falado, sem comentários.',
                    },
                  ],
                },
              ],
            }),
          },
          16000
        );

        const data = await response.json();
        if (data.error) {
          const errMsg = data.error.message || '';
          if (AppError.isQuotaExceeded(errMsg, data.error.status)) {
            quotaExhaustedModels.add(model);
          }
          continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text.trim();
        }
      } catch (_) {}
    }

    return null;
  },

  async transcribeAudioBase64(base64Audio) {
    return this.transcribeVoiceCommand(base64Audio, 'audio/mp4');
  },
};
