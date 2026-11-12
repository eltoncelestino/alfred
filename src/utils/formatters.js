/**
 * Funções puras de formatação de tempo, datas, duração e texto.
 */

export function formatShortTime(date = new Date()) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFullDateTime(date = new Date()) {
  return date.toLocaleString('pt-BR');
}

export function formatDurationSeconds(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function normalizeSearchText(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"'()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeXmlEntities(text = '') {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function getEditorialGreeting(date = new Date()) {
  const hour = date.getHours();
  let greeting = 'Bom dia';
  if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  else if (hour >= 18 || hour < 4) greeting = 'Boa noite';

  const formattedDate = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return {
    saudacao: greeting,
    dataFormatada: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
  };
}

