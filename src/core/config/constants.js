import { NativeModules, Platform } from 'react-native';

export const CHAVE_GEMINI = process.env.EXPO_PUBLIC_GEMINI_KEY || '';

export const STORAGE_KEYS = {
  EMAIL_CONFIG: '@alfred:email_config_v1',
};

export const DEFAULT_USER_EMAIL =
  process.env.EXPO_PUBLIC_DEFAULT_USER_EMAIL || '';

export const INITIAL_EXHAUSTED_MODELS = [];

/**
 * Detecta dinamicamente o IP/Host do servidor Metro em tempo de execução
 * para que os endpoints locais (/alfred-tts e /alfred-emails na porta 8081)
 * funcionem independentemente do endereço IP atribuído via DHCP na rede Wi-Fi.
 */
export function getMetroServerBaseUrl() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL && typeof scriptURL === 'string') {
      const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::(\d+))?/i);
      if (match && match[1]) {
        const host = match[1];
        const port = match[2] || '8081';
        return `http://${host}:${port}`;
      }
    }
  } catch {
    // Fallback silencioso
  }
  const fallbackHost =
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME ||
    (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${fallbackHost}:8081`;
}

export const ENDPOINTS = {
  get ttsLocal() {
    return `${getMetroServerBaseUrl()}/alfred-tts`;
  },
  get metroTts() {
    return `${getMetroServerBaseUrl()}/alfred-tts`;
  },
  get emailsLocal() {
    return `${getMetroServerBaseUrl()}/alfred-emails`;
  },
  get metroEmails() {
    return `${getMetroServerBaseUrl()}/alfred-emails`;
  },
  openMeteoForecast: 'https://api.open-meteo.com/v1/forecast',
  openMeteoUrl: 'https://api.open-meteo.com/v1/forecast',
  reverseGeocode: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  reverseGeocodeUrl: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  googleNewsRss: 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  g1NewsRss: 'https://g1.globo.com/rss/g1/',
  newsRssFeeds: [
    'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    'https://g1.globo.com/rss/g1/',
  ],
  gmailMessages: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
  gmailMessagesUrl: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

export const MODELOS_AUDIO_GEMINI = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

export const MODELOS_TEXTO_GEMINI = [
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

export const MODELOS_TTS_GEMINI = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

export const VOICE_CONFIG = {
  edgeVoiceName: 'pt-BR-AntonioNeural',
  neuralMaleVoice: 'pt-BR-AntonioNeural',
  geminiVoiceName: 'Charon',
  geminiFallbackVoice: 'Charon',
  language: 'pt-BR',
  wakeWordGreeting: 'Sim, senhor? Estou ouvindo.',
  defaultWakeGreeting: 'Sim, senhor? Estou ouvindo.',
};

export const VAD_CONFIG = {
  standbySpeechDbThreshold: -38,
  armedSpeechDbThreshold: -42,
  minSpeechDurationMs: 320,
  silenceDurationToCommitMs: 1150,
  maxSingleUtteranceMs: 8500,
  sessionRecycleMs: 20000,
  wakeWordWindowMs: 25000,
  pollingIntervalMs: 180,
};

export const QUICK_ACTIONS = [
  {
    id: 'alarmy_done',
    label: 'Missão Alarmy concluída',
    prompt: '__TRIGGER_ALARMY_COMPLETED__',
  },
  {
    id: 'agenda',
    label: 'Repassar a agenda',
    prompt: 'Alfred, repasse a minha agenda de hoje em ordem cronológica.',
  },
  {
    id: 'new_event',
    label: 'Marcar compromisso',
    prompt: 'Alfred, quero marcar um novo compromisso na minha agenda.',
  },
  {
    id: 'emails',
    label: 'Ver meus e-mails',
    prompt:
      'Alfred, verifique meus e-mails mais importantes dizendo apenas o remetente e o assunto.',
  },
  {
    id: 'news',
    label: 'Ler as notícias',
    prompt:
      'Alfred, resuma as principais manchetes de hoje em até três itens de uma frase cada.',
  },
  {
    id: 'weather',
    label: 'Clima de hoje',
    prompt:
      'Alfred, como está o clima agora na minha cidade e preciso levar guarda-chuva hoje?',
  },
];
