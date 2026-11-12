import { DEFAULT_USER_EMAIL } from '../../core/config/constants';

/**
 * Entidade de domínio e validação de credenciais de conta de e-mail.
 */
export const EmailAccountEntity = {
  createDefault() {
    return {
      emailAddress: DEFAULT_USER_EMAIL,
      appPassword: '',
      accessToken: '',
      webhookUrl: '',
    };
  },

  normalize(rawConfig) {
    return {
      emailAddress: String(rawConfig?.emailAddress || DEFAULT_USER_EMAIL).trim(),
      appPassword: String(rawConfig?.appPassword || '').trim(),
      accessToken: String(rawConfig?.accessToken || '').trim(),
      webhookUrl: String(rawConfig?.webhookUrl || '').trim(),
    };
  },

  isConnected(config) {
    if (!config) return false;
    return Boolean(
      config.appPassword?.trim() ||
        config.accessToken?.trim() ||
        config.webhookUrl?.trim()
    );
  },

  validate(config) {
    const normalized = this.normalize(config);
    if (!this.isConnected(normalized)) {
      return {
        valid: false,
        error:
          'Informe a Senha de App de 16 letras, o Token OAuth ou a URL do Apps Script.',
      };
    }
    return { valid: true, config: normalized };
  },
};

