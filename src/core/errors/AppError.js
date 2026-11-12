/**
 * Erro estruturado da aplicação para tratamento consistente entre camadas.
 */
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  static isQuotaExceeded(errorMessage = '', status = '') {
    const msg = String(errorMessage).toLowerCase();
    return (
      status === 'RESOURCE_EXHAUSTED' ||
      msg.includes('exceeded your current quota') ||
      msg.includes('no longer available') ||
      msg.includes('quota exceeded')
    );
  }
}

