import * as FileSystem from 'expo-file-system/legacy';
import { EmailAccountEntity } from '../../domain/entities/EmailAccount';

const EMAIL_CONFIG_KEY = 'alfred_email_config_v1';
const EMAIL_CONFIG_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}alfred_email_config.json`
  : null;

/**
 * Repository Pattern: Abstrai a persistência local da configuração de e-mail (Web + iOS/Android).
 */
export const EmailConfigRepository = {
  async load() {
    try {
      if (!EMAIL_CONFIG_FILE) {
        if (typeof localStorage !== 'undefined') {
          const rawWeb = localStorage.getItem(EMAIL_CONFIG_KEY);
          if (rawWeb) return EmailAccountEntity.normalize(JSON.parse(rawWeb));
        }
        return EmailAccountEntity.createDefault();
      }
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
      if (!EMAIL_CONFIG_FILE) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
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
      if (!EMAIL_CONFIG_FILE) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(EMAIL_CONFIG_KEY);
        }
        return empty;
      }
      await FileSystem.deleteAsync(EMAIL_CONFIG_FILE, { idempotent: true });
    } catch (_) {}
    return empty;
  },
};
