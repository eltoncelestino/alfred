/**
 * Caso de Uso: Extrai diretivas estruturadas da resposta do modelo (como salvamento
 * confirmado de compromisso na agenda) e limpa o texto falado para garantir que
 * nenhuma marcação, markdown ou tag técnica seja lida em voz alta.
 */
export function processAssistantDirectives(rawText = '') {
  let spokenText = String(rawText || '');
  const savedEvents = [];

  const agendaTagRegex = /\[\[AGENDA_SAVE:(\{[\s\S]*?\})\]\]/g;
  let match = agendaTagRegex.exec(spokenText);
  while (match !== null) {
    try {
      const payload = JSON.parse(match[1]);
      if (payload && payload.title) {
        savedEvents.push({
          title: payload.title,
          date: payload.date,
          time: payload.time,
          durationMinutes: payload.durationMinutes || 60,
        });
      }
    } catch (error) {
      console.warn('Falha ao interpretar tag AGENDA_SAVE:', error);
    }
    match = agendaTagRegex.exec(spokenText);
  }

  // Remove tags técnicas e qualquer formatação markdown residual para leitura limpa em voz alta
  spokenText = spokenText
    .replace(agendaTagRegex, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/`/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    spokenText,
    savedEvents,
  };
}

