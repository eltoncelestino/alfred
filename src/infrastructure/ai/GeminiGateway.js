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

function extractTextFromCandidate(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const nonThoughtPart =
    parts.find((p) => !p.thought && typeof p.text === 'string' && p.text.trim()) ||
    parts[parts.length - 1];
  const raw = String(nonThoughtPart?.text || '').trim();
  return raw.replace(/^thought\s*\n+/i, '').trim();
}

// Disjuntor de cota em memória compartilhado pela sessão
const quotaExhaustedModels = new Set(INITIAL_EXHAUSTED_MODELS);
let lastDiagnosticErrorMessage = null;

async function callGeminiModelEndpoint(model, body, timeoutMs = 20000) {
  // 1. Se houver chave no cliente, tenta direto na API oficial do Google Gemini
  if (GEMINI_API_KEY) {
    try {
      const directUrl = `${ENDPOINTS.geminiBaseUrl}/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetchWithTimeout(
        directUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
      return await response.json();
    } catch (directErr) {
      // Se falhou por rede/CORS/XHR, tenta via proxy local do Metro (/alfred-gemini)
      try {
        const proxyResp = await fetchWithTimeout(
          ENDPOINTS.metroGemini,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, apiKey: GEMINI_API_KEY, body }),
          },
          timeoutMs
        );
        return await proxyResp.json();
      } catch (_) {
        throw directErr;
      }
    }
  }

  // 2. Se a chave não estiver embutida no bundle do cliente, usa o proxy local do Metro (.env.local)
  const proxyResp = await fetchWithTimeout(
    ENDPOINTS.metroGemini,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, body }),
    },
    timeoutMs
  );
  return await proxyResp.json();
}

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

  getLastDiagnosticError() {
    return lastDiagnosticErrorMessage;
  },

  clearLastDiagnosticError() {
    lastDiagnosticErrorMessage = null;
  },

  async generateAssistantReply(promptOrHistory) {
    let lastError = null;
    const errorReport = [];

    // Se todos os modelos tiverem sido marcados anteriormente, limpa o cache para tentar de novo
    const availableModels = MODELOS_TEXTO_GEMINI.filter(
      (m) => !quotaExhaustedModels.has(m)
    );
    const modelsToTry =
      availableModels.length > 0 ? availableModels : MODELOS_TEXTO_GEMINI;

    for (const model of modelsToTry) {
      try {
        const body = buildModelRequestBody(model, promptOrHistory);
        const data = await callGeminiModelEndpoint(model, body, 20000);

        if (data.error) {
          const errMsg = data.error.message || 'Erro na API do Gemini';
          if (AppError.isQuotaExceeded(errMsg, data.error.status)) {
            quotaExhaustedModels.add(model);
          }
          throw new AppError(`[${model}] ${errMsg}`, data.error.status);
        }

        const text = extractTextFromCandidate(data);
        if (text) {
          lastDiagnosticErrorMessage = null;
          return text;
        }
      } catch (error) {
        lastError = error;
        errorReport.push(`${model}: ${error.message}`);
        console.warn(
          `[GeminiGateway] Modelo ${model} falhou, alternando para o próximo:`,
          error.message
        );
      }
    }

    lastDiagnosticErrorMessage = errorReport.join(' | ');
    console.error('[GeminiGateway] Todos os modelos falharam:', lastDiagnosticErrorMessage);
    if (lastError && AppError.isQuotaExceeded(lastError.message)) {
      throw lastError;
    }
    return 'Perdão, tive uma oscilação momentânea na conexão. Poderia repetir?';
  },

  async transcribeVoiceCommand(
    base64Audio,
    mimeType = 'audio/mp4',
    { expectWakeWord = true } = {}
  ) {
    const availableModels = MODELOS_AUDIO_GEMINI.filter(
      (m) => !quotaExhaustedModels.has(m)
    );
    const modelsToTry =
      availableModels.length > 0 ? availableModels : MODELOS_AUDIO_GEMINI;

    const sttInstruction = expectWakeWord
      ? 'Transcreva fielmente tudo o que foi falado em português neste áudio. Se o usuário disser o nome do assistente ("Alfred", ou algo parecido como "Alfredo", "Al Fred", "Ao Fred"), escreva "Alfred" e transcreva também todo o restante da frase completa. Se houver apenas ruído ambiente, respiração ou silêncio sem fala humana inteligível, responda apenas: [SILENCIO]. Retorne somente a transcrição, sem comentários.'
      : 'Transcreva fielmente e por completo a instrução falada em português do Brasil neste áudio. NÃO substitua palavras por "Alfred" se a pessoa não disse "Alfred". Se houver apenas ruído ambiente, respiração ou silêncio sem fala humana inteligível, responda apenas: [SILENCIO]. Retorne somente o texto exato que a pessoa falou, sem comentários.';

    let lastSttError = null;

    for (const model of modelsToTry) {
      try {
        const body = {
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
                  text: sttInstruction,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        };

        const data = await callGeminiModelEndpoint(model, body, 16000);
        if (data.error) {
          const errMsg = data.error.message || 'Erro STT';
          lastSttError = new AppError(`[${model}] ${errMsg}`, data.error.status);
          console.warn(`[GeminiGateway STT] Modelo ${model} falhou:`, errMsg);
          if (AppError.isQuotaExceeded(errMsg, data.error.status)) {
            quotaExhaustedModels.add(model);
          }
          continue;
        }

        const text = extractTextFromCandidate(data);
        if (text) {
          return text;
        }
      } catch (err) {
        lastSttError = err;
        console.warn(`[GeminiGateway STT] Erro no modelo ${model}:`, err.message);
      }
    }

    if (lastSttError && AppError.isQuotaExceeded(lastSttError.message)) {
      throw lastSttError;
    }

    return null;
  },

  async transcribeAudioBase64(base64Audio) {
    return this.transcribeVoiceCommand(base64Audio, 'audio/mp4');
  },
};
