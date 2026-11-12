import * as FileSystem from 'expo-file-system/legacy';
import { AgendaEventEntity } from '../../domain/entities/AgendaEvent';

const MORNING_STATE_FILE = `${FileSystem.documentDirectory}alfred_morning_routine_state_v1.json`;

/**
 * Repositório que armazena o estado diário do gatilho da rotina matinal
 * (evita repetir a abertura caso o alarme do iPhone e o Alarmy toquem em sequência).
 */
export const MorningRoutineStateRepository = {
  async getState() {
    try {
      const info = await FileSystem.getInfoAsync(MORNING_STATE_FILE);
      if (!info.exists) {
        return { lastTriggeredDate: null, lastTriggerSource: null };
      }
      const raw = await FileSystem.readAsStringAsync(MORNING_STATE_FILE);
      if (!raw) {
        return { lastTriggeredDate: null, lastTriggerSource: null };
      }
      return JSON.parse(raw);
    } catch {
      return { lastTriggeredDate: null, lastTriggerSource: null };
    }
  },

  async markTriggeredToday(source = 'manual') {
    const today = AgendaEventEntity.getTodayIsoDate();
    const nextState = {
      lastTriggeredDate: today,
      lastTriggerSource: source,
      triggeredAt: new Date().toISOString(),
    };
    try {
      await FileSystem.writeAsStringAsync(
        MORNING_STATE_FILE,
        JSON.stringify(nextState)
      );
    } catch {}
    return nextState;
  },

  async resetTodayForTesting() {
    try {
      await FileSystem.deleteAsync(MORNING_STATE_FILE, { idempotent: true });
    } catch {}
  },
};
