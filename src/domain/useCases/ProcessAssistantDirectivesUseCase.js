/**
 * Caso de Uso: Extrai diretivas estruturadas da resposta do modelo (como salvamento
 * confirmado de compromisso na agenda) e limpa o texto falado para garantir que
 * nenhuma marcação, markdown ou tag técnica seja lida em voz alta.
 */
export function processAssistantDirectives(rawText = '') {
  let spokenText = String(rawText || '');
  const savedEvents = [];
  const removedEvents = [];
  const updatedEvents = [];
  const youtubeQueries = [];

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

  const removeTagRegex = /\[\[AGENDA_REMOVE:(\{[\s\S]*?\})\]\]/g;
  let removeMatch = removeTagRegex.exec(spokenText);
  while (removeMatch !== null) {
    try {
      const payload = JSON.parse(removeMatch[1]);
      if (payload && (payload.id || payload.title)) {
        removedEvents.push({
          id: payload.id,
          title: payload.title,
          date: payload.date,
          time: payload.time,
        });
      }
    } catch (error) {
      console.warn('Falha ao interpretar tag AGENDA_REMOVE:', error);
    }
    removeMatch = removeTagRegex.exec(spokenText);
  }

  const updateTagRegex = /\[\[AGENDA_UPDATE:(\{[\s\S]*?\})\]\]/g;
  let updateMatch = updateTagRegex.exec(spokenText);
  while (updateMatch !== null) {
    try {
      const payload = JSON.parse(updateMatch[1]);
      if (payload && (payload.id || payload.matchTitle || payload.title)) {
        updatedEvents.push({
          id: payload.id,
          matchTitle: payload.matchTitle,
          matchDate: payload.matchDate,
          matchTime: payload.matchTime,
          title: payload.title,
          date: payload.date,
          time: payload.time,
          durationMinutes: payload.durationMinutes || 60,
        });
      }
    } catch (error) {
      console.warn('Falha ao interpretar tag AGENDA_UPDATE:', error);
    }
    updateMatch = updateTagRegex.exec(spokenText);
  }

  const youtubeTagRegex = /\[\[YOUTUBE_PLAY:(\{[\s\S]*?\})\]\]/g;
  let ytMatch = youtubeTagRegex.exec(spokenText);
  while (ytMatch !== null) {
    try {
      const payload = JSON.parse(ytMatch[1]);
      if (payload && payload.query) {
        youtubeQueries.push({
          query: String(payload.query).trim(),
        });
      }
    } catch (error) {
      console.warn('Falha ao interpretar tag YOUTUBE_PLAY:', error);
    }
    ytMatch = youtubeTagRegex.exec(spokenText);
  }

  // Remove tags técnicas e qualquer formatação markdown residual para leitura limpa em voz alta
  spokenText = spokenText
    .replace(agendaTagRegex, '')
    .replace(removeTagRegex, '')
    .replace(updateTagRegex, '')
    .replace(youtubeTagRegex, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/`/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    spokenText,
    savedEvents,
    removedEvents,
    updatedEvents,
    youtubeQueries,
  };
}

