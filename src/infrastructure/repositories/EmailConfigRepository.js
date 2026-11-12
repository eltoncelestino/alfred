import * as FileSystem from 'expo-file-system/legacy';
import { EmailAccountEntity } from '../../domain/entities/EmailAccount';

const EMAIL_CONFIG_FILE = `${FileSystem.documentDirectory}alfred_email_config.json`;

/**
 * Repository Pattern: Abstrai a persistência local da configuração de e-mail.
 */
export const EmailConfigRepository = {
  async load() {
    try {
      const info = await FileSystem.getInfoAsync(EMAIL_CONFIG_FILE);
      if (!info.exists) {
        return EmailAccountEntity.createDefault();
      }
      const raw = await FileSystem.readAsStringAsync(EMAIL_CONFIG_FILE);
      return EmailAccountEntity.normalize(JSON.parse(raw));
    } catch (_) {
      return EmailAccountEntity.createDefault();
    }
  },

  async save(config) {
    const normalized = EmailAccountEntity.normalize(config);
    try {
      await FileSystem.writeAsStringAsync(
        EMAIL_CONFIG_FILE,
        JSON.stringify(normalized)
      );
    } catch (_) {}
    return normalized;
  },

  async clear() {
    const empty = EmailAccountEntity.createDefault();
    try {
      await FileSystem.deleteAsync(EMAIL_CONFIG_FILE, { idempotent: true });
    } catch (_) {}
    return empty;
  },
};
