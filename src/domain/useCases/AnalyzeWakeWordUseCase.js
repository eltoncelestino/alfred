import { normalizeSearchText } from '../../utils/formatters';

const WAKE_WORD_PATTERNS = [
  'alfred',
  'alfredo',
  'aufred',
  'al fred',
  'ao fred',
  'o fred',
  'oh fred',
  'halffred',
  'alfre',
  'alferd',
  'afraid',
  'all fred',
  'fred',
];

/**
 * Use Case de Domínio: Analisa se uma transcrição de voz contém o chamado
 * pela palavra de ativação "Alfred" (incluindo variações fonéticas) e distingue
 * entre um chamado isolado ("Oi Alfred") e um comando direto ("Alfred, leia as notícias").
 */
export function analyzeWakeWordCall(rawText) {
  const textoOriginal = String(rawText || '').trim();
  const normalizado = normalizeSearchText(textoOriginal);

  const contemNome = WAKE_WORD_PATTERNS.some((pattern) =>
    normalizado.includes(pattern)
  );

  let resto = normalizado;
  for (const pattern of WAKE_WORD_PATTERNS) {
    resto = resto.replace(pattern, ' ');
  }

  resto = resto
    .replace(
      /\b(oi|ola|ei|hey|bom dia|boa tarde|boa noite|por favor|escuta|fala|ai|ta ai)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  const apenasChamouNome = contemNome && resto.length < 4;
  const command = apenasChamouNome ? '' : resto ? textoOriginal : '';

  return {
    called: contemNome,
    command,
    contemNome,
    apenasChamouNome,
    comandoExtraido: resto,
    normalizado,
  };
}

/**
 * Use Case de Domínio: Identifica se uma frase falada já contém uma intenção
 * explícita de comando direcionada ao assistente (clima, e-mail, notícias, agenda, rotina).
 */
export function detectDirectCommandIntent(rawText) {
  const normalizado = normalizeSearchText(rawText);

  const directKeywords = [
    'leia meus emails',
    'leia meus e-mails',
    'ler meus emails',
    'ler meus e-mails',
    'ver meus emails',
    'ver meus e-mails',
    'caixa de entrada',
    'como esta o clima',
    'como esta o tempo',
    'previsao do tempo',
    'quais sao as noticias',
    'principais manchetes',
    'minha agenda',
    'marcar compromisso',
    'comecar o dia',
    'iniciar rotina',
  ];

  return directKeywords.some((kw) => normalizado.includes(kw));
}
