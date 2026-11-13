import { formatShortTime } from '../../utils/formatters';

/**
 * Entidade de domínio e Factory Method para mensagens do diálogo.
 */
export class MessageEntity {
  static create({
    id,
    autor,
    texto,
    timestamp,
    diagnosticError = null,
    youtubeAction = null,
  }) {
    return {
      id: id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      autor,
      texto: (texto || '').trim(),
      timestamp: timestamp || formatShortTime(),
      diagnosticError,
      youtubeAction,
    };
  }

  static createUserMessage(texto) {
    return MessageEntity.create({
      autor: 'Você',
      texto,
    });
  }

  static createAssistantMessage(
    texto,
    diagnosticError = null,
    youtubeAction = null
  ) {
    return MessageEntity.create({
      autor: 'Alfred',
      texto,
      diagnosticError,
      youtubeAction,
    });
  }

  static createInitialGreeting() {
    return MessageEntity.create({
      id: 'welcome-1',
      autor: 'Alfred',
      texto:
        'Olá! Aqui é o Alfred. Estou pronto para ajudar assim que encerrar seu despertador ou quando me chamar pelo nome. Por onde quer começar hoje?',
    });
  }
}
