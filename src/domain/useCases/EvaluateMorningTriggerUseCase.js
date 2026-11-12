import { AgendaEventEntity } from '../entities/AgendaEvent';

/**
 * Caso de Uso: Avalia o gatilho de início da Rotina Matinal para os dois despertadores
 * do usuário (Alarme padrão do iPhone e aplicativo Alarmy).
 *
 * Regras implementadas:
 * 1. Se o usuário apenas adiar (soneca / snooze), NÃO inicia a rotina.
 * 2. Se for o Alarmy e a missão de despertar ainda estiver em andamento, NÃO fala nada.
 * 3. Se os dois alarmes tocarem em sequência no mesmo dia, inicia a rotina UMA ÚNICA VEZ
 *    no primeiro encerramento confirmado e não repete no segundo.
 * 4. Se o usuário acionar manualmente ("Começar o dia" ou comando de voz explícito), permite iniciar.
 */
export function evaluateMorningAlarmTrigger({
  source = 'manual', // 'iphone_alarm' | 'alarmy' | 'manual' | 'voice'
  action = 'dismissed', // 'dismissed' | 'snoozed' | 'mission_in_progress' | 'mission_completed'
  morningState = { lastTriggeredDate: null },
  forceManual = false,
}) {
  const today = AgendaEventEntity.getTodayIsoDate();

  // Regra 1: Soneca (adiar) nunca inicia a rotina
  if (action === 'snoozed') {
    return {
      shouldStart: false,
      reason: 'snoozed',
      silent: true,
    };
  }

  // Regra 2: Alarmy só inicia após a missão de despertar ser concluída
  if (source === 'alarmy' && action !== 'mission_completed') {
    return {
      shouldStart: false,
      reason: 'alarmy_mission_pending',
      silent: true,
    };
  }

  // Regra 3: Se dois alarmes tocarem em sequência no mesmo dia, inicia apenas no primeiro encerramento
  if (!forceManual && morningState?.lastTriggeredDate === today) {
    return {
      shouldStart: false,
      reason: 'already_triggered_today',
      silent: true,
    };
  }

  return {
    shouldStart: true,
    reason: 'confirmed_alarm_dismissal',
    silent: false,
    isAlarmyMissionCompleted: source === 'alarmy' && action === 'mission_completed',
  };
}

