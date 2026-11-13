import * as FileSystem from 'expo-file-system/legacy';
import { AgendaEventEntity } from '../../domain/entities/AgendaEvent';
import { normalizeSearchText } from '../../utils/formatters';

const AGENDA_STORAGE_KEY = 'alfred_agenda_events_v1';
const AGENDA_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}alfred_agenda_events_v1.json`
  : null;

async function persistEvents(events) {
  try {
    if (!AGENDA_FILE) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(events));
      }
    } else {
      await FileSystem.writeAsStringAsync(AGENDA_FILE, JSON.stringify(events));
    }
  } catch (error) {
    console.warn('Falha ao persistir agenda:', error);
  }
}

function matchesEventCriteria(event, criteria = {}) {
  if (!event) return false;
  if (criteria.id && event.id === criteria.id) return true;

  const targetTitle = normalizeSearchText(
    criteria.matchTitle || criteria.title || ''
  );
  const eventTitle = normalizeSearchText(event.title || '');
  if (!targetTitle) return false;

  const titleMatches =
    eventTitle === targetTitle ||
    eventTitle.includes(targetTitle) ||
    targetTitle.includes(eventTitle);

  if (!titleMatches) return false;

  const targetDate = criteria.matchDate || criteria.date;
  if (targetDate && event.date && event.date !== targetDate) {
    return false;
  }

  const targetTime = criteria.matchTime || criteria.time;
  if (targetTime && event.time && event.time !== targetTime) {
    return false;
  }

  return true;
}

function getEventDedupeKey(event) {
  return `${normalizeSearchText(event?.title || '')}|${event?.date || ''}|${event?.time || ''}`;
}

function deduplicateEvents(events) {
  const seen = new Set();
  const unique = [];
  for (const evt of events) {
    const key = getEventDedupeKey(evt);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(evt);
    }
  }
  return AgendaEventEntity.sortChronologically(unique);
}

/**
 * Repositório para persistência local dos compromissos e lembretes da agenda (Web + iOS/Android).
 */
export const AgendaRepository = {
  async loadAll() {
    try {
      if (!AGENDA_FILE) {
        if (typeof localStorage !== 'undefined') {
          const rawWeb = localStorage.getItem(AGENDA_STORAGE_KEY);
          if (!rawWeb) return [];
          const parsedWeb = JSON.parse(rawWeb);
          if (!Array.isArray(parsedWeb)) return [];
          const cleanWeb = deduplicateEvents(parsedWeb);
          if (cleanWeb.length !== parsedWeb.length) {
            await persistEvents(cleanWeb);
          }
          return cleanWeb;
        }
        return [];
      }
      const info = await FileSystem.getInfoAsync(AGENDA_FILE);
      if (!info.exists) return [];
      const raw = await FileSystem.readAsStringAsync(AGENDA_FILE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cleanNative = deduplicateEvents(parsed);
      if (cleanNative.length !== parsed.length) {
        await persistEvents(cleanNative);
      }
      return cleanNative;
    } catch (error) {
      console.warn('Falha ao carregar agenda:', error);
      return [];
    }
  },

  async addEvent(eventInput) {
    const current = await this.loadAll();
    const newEvent = AgendaEventEntity.create(eventInput);
    const newKey = getEventDedupeKey(newEvent);
    const existing = current.find((item) => getEventDedupeKey(item) === newKey);
    if (existing) {
      return { event: existing, allEvents: current };
    }
    const updated = deduplicateEvents([...current, newEvent]);
    await persistEvents(updated);
    return { event: newEvent, allEvents: updated };
  },

  async removeEvent(eventId) {
    const current = await this.loadAll();
    const updated = current.filter((item) => item.id !== eventId);
    await persistEvents(updated);
    return updated;
  },

  async removeByCriteria(criteria) {
    const current = await this.loadAll();
    const updated = current.filter((item) => !matchesEventCriteria(item, criteria));
    const removedCount = current.length - updated.length;
    if (removedCount > 0) {
      await persistEvents(updated);
    }
    return { removedCount, allEvents: updated };
  },

  async updateByCriteria(criteria) {
    const current = await this.loadAll();
    let updatedCount = 0;

    const nextList = current.map((item) => {
      if (!matchesEventCriteria(item, criteria)) return item;
      updatedCount += 1;
      return AgendaEventEntity.create({
        ...item,
        id: item.id,
        title: criteria.title || item.title,
        date: criteria.date || item.date,
        time: criteria.time || item.time,
        durationMinutes: criteria.durationMinutes || item.durationMinutes || 60,
      });
    });

    const sorted = deduplicateEvents(nextList);
    if (updatedCount > 0) {
      await persistEvents(sorted);
    }
    return { updatedCount, allEvents: sorted };
  },
};
