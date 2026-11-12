import * as FileSystem from 'expo-file-system/legacy';
import { AgendaEventEntity } from '../../domain/entities/AgendaEvent';

const AGENDA_FILE = `${FileSystem.documentDirectory}alfred_agenda_events_v1.json`;

/**
 * Repositório para persistência local dos compromissos e lembretes da agenda.
 */
export const AgendaRepository = {
  async loadAll() {
    try {
      const info = await FileSystem.getInfoAsync(AGENDA_FILE);
      if (!info.exists) return [];
      const raw = await FileSystem.readAsStringAsync(AGENDA_FILE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return AgendaEventEntity.sortChronologically(parsed);
    } catch (error) {
      console.warn('Falha ao carregar agenda:', error);
      return [];
    }
  },

  async addEvent(eventInput) {
    const current = await this.loadAll();
    const newEvent = AgendaEventEntity.create(eventInput);
    const updated = AgendaEventEntity.sortChronologically([...current, newEvent]);
    try {
      await FileSystem.writeAsStringAsync(AGENDA_FILE, JSON.stringify(updated));
    } catch (error) {
      console.warn('Falha ao salvar evento na agenda:', error);
    }
    return { event: newEvent, allEvents: updated };
  },

  async removeEvent(eventId) {
    const current = await this.loadAll();
    const updated = current.filter((item) => item.id !== eventId);
    try {
      await FileSystem.writeAsStringAsync(AGENDA_FILE, JSON.stringify(updated));
    } catch (error) {
      console.warn('Falha ao remover evento da agenda:', error);
    }
    return updated;
  },
};
