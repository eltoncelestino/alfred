import * as FileSystem from 'expo-file-system/legacy';
import { AgendaEventEntity } from '../../domain/entities/AgendaEvent';

const MORNING_STATE_KEY = 'alfred_morning_routine_state_v1';
const MORNING_STATE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}alfred_morning_routine_state_v1.json`
  : null;

/**
 * Repositório que armazena o estado diário do gatilho da rotina matinal
 * (evita repetir a abertura caso o alarme do iPhone e o Alarmy toquem em sequência).
 */
export const MorningRoutineStateRepository = {
  async getState() {
    try {
      if (!MORNING_STATE_FILE) {
        if (typeof localStorage !== 'undefined') {
          const rawWeb = localStorage.getItem(MORNING_STATE_KEY);
          if (rawWeb) return JSON.parse(rawWeb);
        }
        return { lastTriggeredDate: null, lastTriggerSource: null };
      }
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
      if (!MORNING_STATE_FILE) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(MORNING_STATE_KEY, JSON.stringify(nextState));
        }
        return nextState;
      }
      await FileSystem.writeAsStringAsync(
        MORNING_STATE_FILE,
        JSON.stringify(nextState)
      );
    } catch {}
    return nextState;
  },

  async resetTodayForTesting() {
    try {
      if (!MORNING_STATE_FILE) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(MORNING_STATE_KEY);
        }
        return;
      }
      await FileSystem.deleteAsync(MORNING_STATE_FILE, { idempotent: true });
    } catch {}
  },
};
