import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { AppError } from '../../../core/errors/AppError';
import { EmailAccountEntity } from '../../../domain/entities/EmailAccount';
import { MessageEntity } from '../../../domain/entities/Message';
import { buildContextBriefingBlock } from '../../../domain/useCases/BuildContextBriefingUseCase';
import { evaluateMorningAlarmTrigger } from '../../../domain/useCases/EvaluateMorningTriggerUseCase';
import { processAssistantDirectives } from '../../../domain/useCases/ProcessAssistantDirectivesUseCase';
import { GeminiGateway } from '../../../infrastructure/ai/GeminiGateway';
import { EmailService } from '../../../infrastructure/integrations/EmailService';
import { NewsService } from '../../../infrastructure/integrations/NewsService';
import { WeatherService } from '../../../infrastructure/integrations/WeatherService';
import { AgendaRepository } from '../../../infrastructure/repositories/AgendaRepository';
import { EmailConfigRepository } from '../../../infrastructure/repositories/EmailConfigRepository';
import { MorningRoutineStateRepository } from '../../../infrastructure/repositories/MorningRoutineStateRepository';
import { VoiceSynthesisService } from '../../../infrastructure/speech/VoiceSynthesisService';

/**
 * Custom Hook que orquestra o estado de conversação, gatilho pós-alarme (iPhone / Alarmy),
 * agenda com detecção de conflitos, integrações reais (Clima, Notícias, E-mail) e síntese de voz.
 */
export function useAlfredAssistant({ onAfterAssistantCycle }) {
  const [messages, setMessages] = useState([MessageEntity.createInitialGreeting()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Processando solicitação...');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Dados reais das integrações e agenda
  const [weatherData, setWeatherData] = useState(null);
  const [newsData, setNewsData] = useState([]);
  const [agendaEvents, setAgendaEvents] = useState([]);
  const [emailConfig, setEmailConfig] = useState(EmailAccountEntity.createDefault());
  const [emailSummary, setEmailSummary] = useState({
    connected: false,
    messages: [],
    error: null,
  });
  const [syncingIntegrations, setSyncingIntegrations] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);

  const isBusyRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const voiceServiceRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  if (!voiceServiceRef.current) {
    voiceServiceRef.current = new VoiceSynthesisService({
      onSpeakingStateChange: (speaking) => {
        isSpeakingRef.current = speaking;
        setIsSpeaking(speaking);
      },
    });
  }

  // Pré-aquecimento da saudação de ativação por voz
  useEffect(() => {
    voiceServiceRef.current?.prewarmWakeGreeting();
    return () => {
      voiceServiceRef.current?.stopActivePlayback();
    };
  }, []);

  /**
   * Sincroniza Clima, Manchetes, Caixa de Entrada de E-mail e Agenda em paralelo.
   */
  const syncAllIntegrations = useCallback(
    async (overrideEmailConfig = null) => {
      setSyncingIntegrations(true);
      try {
        const storedEmailConfig =
          overrideEmailConfig || (await EmailConfigRepository.load());
        setEmailConfig(storedEmailConfig);

        const [weatherRes, newsRes, emailRes, storedAgenda] = await Promise.all([
          WeatherService.fetchCurrentWeather(),
          NewsService.fetchTopHeadlines(),
          EmailService.fetchRecentEmails(storedEmailConfig),
          AgendaRepository.loadAll(),
        ]);

        if (weatherRes) setWeatherData(weatherRes);
        if (newsRes && newsRes.length > 0) setNewsData(newsRes);
        setEmailSummary(emailRes);
        setAgendaEvents(storedAgenda);

        return {
          weather: weatherRes || weatherData,
          news: newsRes?.length > 0 ? newsRes : newsData,
          emailConfig: storedEmailConfig,
          emailSummary: emailRes,
          agendaEvents: storedAgenda,
        };
      } catch (error) {
        console.log('Erro na sincronização de integrações:', error);
        return {
          weather: weatherData,
          news: newsData,
          emailConfig,
          emailSummary,
          agendaEvents,
        };
      } finally {
        setSyncingIntegrations(false);
      }
    },
    [agendaEvents, emailConfig, emailSummary, newsData, weatherData]
  );

  useEffect(() => {
    syncAllIntegrations();
  }, []);

  /**
   * Salva e sincroniza a configuração de e-mail do usuário.
   */
  const handleSaveEmailConfig = useCallback(
    async (newConfig) => {
      const saved = await EmailConfigRepository.save(newConfig);
      setEmailConfig(saved);
      setEmailModalVisible(false);
      await syncAllIntegrations(saved);
    },
    [syncAllIntegrations]
  );

  /**
   * Desvincula a conta de e-mail configurada.
   */
  const handleDisconnectEmail = useCallback(async () => {
    const empty = await EmailConfigRepository.clear();
    setEmailConfig(empty);
    setEmailSummary({ connected: false, messages: [], error: null });
    setEmailModalVisible(false);
  }, []);

  /**
   * Interrompe imediatamente a fala atual do Alfred.
   */
  const stopSpeaking = useCallback(async () => {
    await voiceServiceRef.current?.stopActivePlayback();
    onAfterAssistantCycle?.();
  }, [onAfterAssistantCycle]);

  /**
   * Sintetiza e reproduz a voz do Alfred.
   */
  const speakText = useCallback(
    async (text, onDoneCallback = null) => {
      await voiceServiceRef.current?.speak(text, () => {
        if (onDoneCallback) {
          onDoneCallback();
        } else {
          onAfterAssistantCycle?.();
        }
      });
    },
    [onAfterAssistantCycle]
  );

  /**
   * Reproduz a saudação curta ("Sim, senhor? Estou ouvindo.") ao detectar "Alfred".
   */
  const speakWakeWordGreeting = useCallback(async (onGreetingFinished) => {
    await voiceServiceRef.current?.speakWakeWordGreeting(onGreetingFinished);
  }, []);

  /**
   * Executa um comando textual ou de voz já transcrito junto ao Gemini com dados reais.
   */
  const executeCommand = useCallback(
    async (
      userCommandText,
      { lockAlreadyAcquired = false, displayUserBubbleText = null } = {}
    ) => {
      const trimmedCommand = (userCommandText || '').trim();
      if (!trimmedCommand) return;

      // Atalho especial para simular conclusão da missão do Alarmy
      if (trimmedCommand === '__TRIGGER_ALARMY_COMPLETED__') {
        await triggerAlarmRoutine({
          source: 'alarmy',
          action: 'mission_completed',
          forceManual: true,
        });
        return;
      }

      if (!lockAlreadyAcquired && isBusyRef.current) return;

      isBusyRef.current = true;
      await voiceServiceRef.current?.stopActivePlayback();

      const bubbleText = displayUserBubbleText || trimmedCommand;
      const historyBeforeCurrent = messagesRef.current;

      setMessages((prev) => [...prev, MessageEntity.createUserMessage(bubbleText)]);
      setInputText('');
      setIsLoading(true);
      setLoadingStage('Sincronizando dados em tempo real...');

      try {
        let currentContext = {
          weather: weatherData,
          news: newsData,
          emailConfig,
          emailSummary,
          agendaEvents,
        };

        const commandNorm = trimmedCommand.toLowerCase();
        const asksAboutEmail =
          commandNorm.includes('e-mail') ||
          commandNorm.includes('email') ||
          commandNorm.includes('caixa de entrada');
        const asksAboutWeather =
          commandNorm.includes('clima') ||
          commandNorm.includes('tempo') ||
          commandNorm.includes('temperatura') ||
          commandNorm.includes('chuva');
        const asksAboutNews =
          commandNorm.includes('notícia') ||
          commandNorm.includes('noticia') ||
          commandNorm.includes('manchete') ||
          commandNorm.includes('jornal');

        if (
          !weatherData ||
          newsData.length === 0 ||
          asksAboutEmail ||
          asksAboutWeather ||
          asksAboutNews
        ) {
          currentContext = await syncAllIntegrations();
        } else {
          const freshAgenda = await AgendaRepository.loadAll();
          setAgendaEvents(freshAgenda);
          currentContext.agendaEvents = freshAgenda;
        }

        setLoadingStage('Elaborando resposta...');
        const contextBlock = buildContextBriefingBlock({
          ...currentContext,
          recentMessages: historyBeforeCurrent,
        });
        const promptForGemini = `${contextBlock}\n\nSOLICITAÇÃO DO USUÁRIO: ${trimmedCommand}`;

        const rawAiResponse = await GeminiGateway.generateAssistantReply(promptForGemini);
        const { spokenText, savedEvents } = processAssistantDirectives(rawAiResponse);

        if (savedEvents.length > 0) {
          for (const evt of savedEvents) {
            const { allEvents } = await AgendaRepository.addEvent(evt);
            setAgendaEvents(allEvents);
          }
        }

        const finalReply =
          spokenText || 'Certo, tudo anotado. Precisa de mais alguma coisa?';

        setMessages((prev) => [
          ...prev,
          MessageEntity.createAssistantMessage(finalReply),
        ]);
        setIsLoading(false);

        await speakText(finalReply);
      } catch (error) {
        console.error('Erro ao processar comando:', error);
        const isQuota = AppError.isQuotaExceeded(error);
        const friendlyMessage = isQuota
          ? 'O limite gratuito de requisições da chave Gemini foi atingido neste minuto. Aguarde trinta segundos e tente novamente.'
          : 'Perdão, encontrei uma instabilidade momentânea ao consultar meus sistemas. Pode repetir?';

        setMessages((prev) => [
          ...prev,
          MessageEntity.createAssistantMessage(friendlyMessage),
        ]);
        setIsLoading(false);
        await speakText(friendlyMessage);
      } finally {
        isBusyRef.current = false;
        onAfterAssistantCycle?.();
      }
    },
    [
      agendaEvents,
      emailConfig,
      emailSummary,
      newsData,
      onAfterAssistantCycle,
      speakText,
      syncAllIntegrations,
      weatherData,
    ]
  );

  /**
   * Aciona a abertura da Rotina Matinal respeitando as regras dos dois despertadores
   * (Alarme padrão do iPhone e missão concluída do Alarmy).
   */
  const triggerAlarmRoutine = useCallback(
    async ({
      source = 'alarmy',
      action = 'mission_completed',
      forceManual = false,
    } = {}) => {
      const morningState = await MorningRoutineStateRepository.getState();
      const decision = evaluateMorningAlarmTrigger({
        source,
        action,
        morningState,
        forceManual,
      });

      if (!decision.shouldStart) {
        console.log(
          `[Alfred Rotina Matinal] Gatilho ignorado (${decision.reason}) para source=${source}, action=${action}`
        );
        return false;
      }

      await MorningRoutineStateRepository.markTriggeredToday(source);

      const userLabel =
        source === 'alarmy'
          ? 'Despertador Alarmy encerrado (missão concluída)'
          : 'Despertador encerrado · Iniciar rotina matinal';

      const openingDirective = `O usuário acabou de encerrar o despertador (${
        source === 'alarmy'
          ? 'concluiu a missão do Alarmy, já está acordado e de pé'
          : 'desativou o alarme do iPhone'
      }). Faça a abertura da ROTINA MATINAL em uma única fala curta, direta e calorosa, exatamente nesta ordem:
1. Saudação adequada ao horário com a hora atual escrita por extenso e reconhecimento breve de que ele já está de pé.
2. Clima local atual com temperatura por extenso e previsão principal do dia (se houver chuva, avise sobre guarda-chuva).
3. Uma frase motivacional curta e original.
4. Pergunta aberta sobre o que ele quer fazer primeiro, oferecendo opções resumidas: notícias, e-mails, agenda ou novo compromisso, mencionando que também pode ajudar com música, trânsito ou casa inteligente.`;

      await executeCommand(openingDirective, {
        displayUserBubbleText: userLabel,
      });
      return true;
    },
    [executeCommand]
  );

  /**
   * Botão principal de início da rotina matinal.
   */
  const startMorningRoutine = useCallback(async () => {
    await triggerAlarmRoutine({
      source: 'alarmy',
      action: 'mission_completed',
      forceManual: true,
    });
  }, [triggerAlarmRoutine]);

  // Suporte a automação do Atalhos do iOS (URL Scheme / Deep Link)
  // Exemplo: exp://<SEU_IP_LOCAL>:8081/--/alarm?source=alarmy&action=mission_completed
  useEffect(() => {
    const handleDeepLink = (event) => {
      try {
        const url = event?.url || '';
        if (!url.includes('alarm')) return;
        const queryString = url.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        const source = params.get('source') || 'iphone_alarm';
        const action =
          params.get('action') ||
          (source === 'alarmy' ? 'mission_completed' : 'dismissed');
        triggerAlarmRoutine({ source, action, forceManual: false });
      } catch {}
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleDeepLink({ url: initialUrl });
    });

    return () => {
      sub?.remove?.();
    };
  }, [triggerAlarmRoutine]);

  return {
    messages,
    setMessages,
    inputText,
    setInputText,
    isLoading,
    setIsLoading,
    loadingStage,
    setLoadingStage,
    isSpeaking,
    isBusyRef,
    isSpeakingRef,
    weatherData,
    newsData,
    agendaEvents,
    emailConfig,
    emailSummary,
    syncingIntegrations,
    emailModalVisible,
    setEmailModalVisible,
    syncAllIntegrations,
    handleSaveEmailConfig,
    handleDisconnectEmail,
    stopSpeaking,
    speakText,
    speakWakeWordGreeting,
    executeCommand,
    startMorningRoutine,
    triggerAlarmRoutine,
  };
}
