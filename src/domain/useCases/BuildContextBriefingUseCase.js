import { formatFullDateTime } from '../../utils/formatters';
import { AgendaEventEntity } from '../entities/AgendaEvent';

/**
 * Caso de Uso: Constrói o bloco determinístico de contexto em tempo real
 * (Data/Hora, Clima, E-mails, Manchetes, Agenda e Histórico recente de conversa)
 * para ser injetado no prompt do modelo de IA sem alucinações.
 */
export function buildContextBriefingBlock({
  weather,
  news,
  emailConfig,
  emailSummary,
  agendaEvents = [],
  recentMessages = [],
}) {
  const nowStr = formatFullDateTime(new Date());
  const todayIso = AgendaEventEntity.getTodayIsoDate();

  let weatherBlock =
    'CLIMA ATUAL: Não foi possível obter a localização/clima neste instante. Diga isso com naturalidade e não invente temperatura.';
  if (weather) {
    weatherBlock = `CLIMA ATUAL EM TEMPO REAL (${weather.city}): Temperatura de ${weather.temperature} graus (${weather.condition}). Máxima de ${weather.maxTemp} graus e mínima de ${weather.minTemp} graus para hoje. Vento de ${weather.windSpeed} km/h.`;
  }

  let emailBlock = `CAIXA DE ENTRADA DE E-MAIL: O usuário ainda NÃO vinculou a conta de e-mail no aplicativo. Se ele pedir para ler e-mails, diga com naturalidade que não tem acesso aos e-mails ainda e ofereça vincular a conta no botão "Vincular meu E-mail" na tela.`;

  if (emailConfig?.connected) {
    if (emailSummary?.error) {
      emailBlock = `CAIXA DE ENTRADA DE E-MAIL (${emailConfig.emailAddress || 'Conta vinculada'}): Houve um problema técnico ao sincronizar (${emailSummary.error}). Avise o usuário com naturalidade e nunca invente remetentes ou assuntos.`;
    } else if (emailSummary?.messages && emailSummary.messages.length > 0) {
      const list = emailSummary.messages
        .map(
          (m, idx) =>
            `${idx + 1}. De: ${m.from} | Assunto: "${m.subject}" | Conteúdo/Resumo: ${m.snippet || 'Sem prévia'}`
        )
        .join('\n');
      emailBlock = `CAIXA DE ENTRADA DE E-MAIL REAL (${emailConfig.emailAddress || emailSummary.provider}):\n${list}\nREGRA DE E-MAIL: Ao listar e-mails inicialmente, diga APENAS o remetente e o assunto dos mais importantes, nunca leia o conteúdo completo de imediato, e pergunte: "Quer arquivar, responder ou ouvir o resto?". Só leia o Conteúdo/Resumo se o usuário pedir para "ouvir o resto".`;
    } else {
      emailBlock = `CAIXA DE ENTRADA DE E-MAIL (${emailConfig.emailAddress || 'Conta vinculada'}): Conectada, sem novos e-mails não lidos no momento.`;
    }
  }

  let newsBlock = 'NOTÍCIAS DE HOJE: Sem manchetes carregadas no momento.';
  if (news && news.length > 0) {
    const list = news
      .slice(0, 5)
      .map((n, idx) => `${idx + 1}. ${n.title}`)
      .join('\n');
    newsBlock = `PRINCIPAIS NOTÍCIAS DE HOJE (resuma em até três itens, uma frase cada, e ao final pergunte se o usuário quer detalhes de alguma):\n${list}`;
  }

  const sortedAgenda = AgendaEventEntity.sortChronologically(agendaEvents);
  const todayEvents = sortedAgenda.filter((e) => e.date === todayIso);
  const futureEvents = sortedAgenda.filter((e) => e.date > todayIso);

  let agendaBlock = `AGENDA DO USUÁRIO (Data de hoje: ${todayIso}): Nenhum compromisso marcado para hoje.`;
  if (todayEvents.length > 0 || futureEvents.length > 0) {
    const todayLines =
      todayEvents.length > 0
        ? todayEvents
            .map(
              (e, i) =>
                `${i + 1}. [HOJE ${e.date}] às ${e.time} (${e.durationMinutes || 60} min) — ${e.title}`
            )
            .join('\n')
        : 'Nenhum compromisso para hoje.';
    const futureLines =
      futureEvents.length > 0
        ? futureEvents
            .slice(0, 6)
            .map(
              (e) =>
                `- [${e.date}] às ${e.time} (${e.durationMinutes || 60} min) — ${e.title}`
            )
            .join('\n')
        : '';

    agendaBlock = `AGENDA DO USUÁRIO (Data de hoje: ${todayIso}):\nCompromissos de hoje:\n${todayLines}${
      futureLines ? `\nPróximos dias:\n${futureLines}` : ''
    }`;
  }

  let historyBlock = '';
  if (recentMessages && recentMessages.length > 0) {
    const lastTurns = recentMessages
      .slice(-6)
      .map((m) => `${m.autor === 'Você' ? 'Usuário' : 'Alfred'}: ${m.texto}`)
      .join('\n');
    historyBlock = `\n=== HISTÓRICO RECENTE DA CONVERSA (mantenha continuidade se o usuário estiver respondendo a uma pergunta anterior sua) ===\n${lastTurns}\n`;
  }

  return `=== DADOS EM TEMPO REAL DO SISTEMA ===
DATA E HORA ATUAL: ${nowStr} (ISO Hoje: ${todayIso})
${weatherBlock}
${emailBlock}
${newsBlock}
${agendaBlock}
${historyBlock}======================================`;
}
