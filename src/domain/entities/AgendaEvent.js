/**
 * Entidade de Compromisso / Evento da Agenda do Usuário.
 * Inclui regras de ordenação cronológica, detecção de conflitos de horário
 * e sugestão automática do próximo horário livre.
 */
export class AgendaEventEntity {
  static create({ title, date, time, durationMinutes = 60, notes = '' }) {
    const cleanTitle = (title || 'Compromisso').trim();
    const cleanDate = (date || AgendaEventEntity.getTodayIsoDate()).trim();
    const cleanTime = AgendaEventEntity.normalizeTime(time || '09:00');

    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      date: cleanDate, // YYYY-MM-DD
      time: cleanTime, // HH:MM
      durationMinutes: Number(durationMinutes) || 60,
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
  }

  static getTodayIsoDate(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static normalizeTime(timeStr) {
    const match = String(timeStr || '')
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '09:00';
    const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  static timeToMinutes(timeStr) {
    const [h, m] = AgendaEventEntity.normalizeTime(timeStr)
      .split(':')
      .map((n) => parseInt(n, 10));
    return h * 60 + m;
  }

  static minutesToTime(totalMinutes) {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  static sortChronologically(events = []) {
    return [...events].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (
        AgendaEventEntity.timeToMinutes(a.time) -
        AgendaEventEntity.timeToMinutes(b.time)
      );
    });
  }

  /**
   * Verifica se um novo evento colide com algum compromisso existente na mesma data
   * e calcula o próximo horário livre.
   */
  static findConflict(existingEvents = [], candidateEvent) {
    const sameDayEvents = AgendaEventEntity.sortChronologically(
      existingEvents.filter((e) => e.date === candidateEvent.date)
    );

    const candStart = AgendaEventEntity.timeToMinutes(candidateEvent.time);
    const candDuration = Number(candidateEvent.durationMinutes) || 60;
    const candEnd = candStart + candDuration;

    const conflictingEvent = sameDayEvents.find((ev) => {
      const evStart = AgendaEventEntity.timeToMinutes(ev.time);
      const evEnd = evStart + (Number(ev.durationMinutes) || 60);
      return candStart < evEnd && candEnd > evStart;
    });

    if (!conflictingEvent) {
      return { hasConflict: false, conflictingEvent: null, nextFreeTime: null };
    }

    // Procura o próximo horário livre em blocos de 30 minutos após o evento conflitante
    let probeStart =
      AgendaEventEntity.timeToMinutes(conflictingEvent.time) +
      (Number(conflictingEvent.durationMinutes) || 60);

    while (probeStart + candDuration <= 22 * 60) {
      const probeEnd = probeStart + candDuration;
      const overlapsAny = sameDayEvents.some((ev) => {
        const evStart = AgendaEventEntity.timeToMinutes(ev.time);
        const evEnd = evStart + (Number(ev.durationMinutes) || 60);
        return probeStart < evEnd && probeEnd > evStart;
      });
      if (!overlapsAny) {
        break;
      }
      probeStart += 30;
    }

    return {
      hasConflict: true,
      conflictingEvent,
      nextFreeTime: AgendaEventEntity.minutesToTime(probeStart),
    };
  }
}

