import { DEFAULT_USER_EMAIL, ENDPOINTS } from '../../core/config/constants';
import { fetchWithTimeout } from '../http/httpClient';

/**
 * Strategy 1: Leitura via Bridge IMAP do servidor Metro (Senha de App de 16 letras)
 */
async function fetchViaImapBridgeStrategy(emailAddress, appPassword) {
  try {
    const resp = await fetchWithTimeout(
      ENDPOINTS.metroEmails,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          appPassword,
        }),
      },
      9500
    );
    const data = await resp.json();
    if (!data.conectado) {
      throw new Error(data.erro || 'Falha ao autenticar via Senha de App no Gmail.');
    }

    const lista = (data.emails || []).slice(0, 5);
    return {
      connected: true,
      provider: 'Gmail IMAP',
      messages: lista,
      error: null,
    };
  } catch (erro) {
    return {
      connected: false,
      provider: 'Gmail IMAP',
      messages: [],
      error: erro.message,
    };
  }
}

/**
 * Strategy 2: Leitura via Webhook / Google Apps Script JSON
 */
async function fetchViaWebhookStrategy(emailAddress, webhookUrl) {
  try {
    const resp = await fetchWithTimeout(webhookUrl.trim(), {}, 6500);
    const data = await resp.json();
    const lista = Array.isArray(data) ? data : data.emails || data.messages || [];

    const normalized = lista.slice(0, 5).map((e) => ({
      from: e.from || e.remetente || 'Remetente',
      subject: e.subject || e.assunto || 'Sem assunto',
      snippet: e.snippet || e.resumo || '',
    }));

    return {
      connected: true,
      provider: 'Webhook',
      messages: normalized,
      error: null,
    };
  } catch (erro) {
    return {
      connected: false,
      provider: 'Webhook',
      messages: [],
      error: erro.message,
    };
  }
}

/**
 * Strategy 3: Leitura via Gmail REST API direta (OAuth 2.0 Access Token)
 */
async function fetchViaGmailOAuthStrategy(emailAddress, accessToken) {
  try {
    const token = accessToken.trim();
    const listResp = await fetchWithTimeout(
      `${ENDPOINTS.gmailMessagesUrl}?q=is:unread+category:primary&maxResults=5`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      6000
    );

    const listData = await listResp.json();
    if (listData.error) {
      throw new Error(
        listData.error.message || 'Token OAuth inválido ou expirado'
      );
    }

    const msgs = listData.messages || [];
    if (msgs.length === 0) {
      return {
        connected: true,
        provider: 'Gmail OAuth',
        messages: [],
        error: null,
      };
    }

    const detalhes = await Promise.all(
      msgs.slice(0, 4).map(async (m) => {
        const r = await fetchWithTimeout(
          `${ENDPOINTS.gmailMessagesUrl}/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${token}` } },
          5000
        );
        const d = await r.json();
        const headers = d.payload?.headers || [];
        const from =
          headers.find((h) => h.name.toLowerCase() === 'from')?.value ||
          'Remetente';
        const subject =
          headers.find((h) => h.name.toLowerCase() === 'subject')?.value ||
          'Sem assunto';
        return {
          id: m.id,
          from: from.replace(/<[^>]+>/g, '').trim(),
          subject,
          snippet: d.snippet || '',
        };
      })
    );

    return {
      connected: true,
      provider: 'Gmail OAuth',
      messages: detalhes,
      error: null,
    };
  } catch (erro) {
    return {
      connected: false,
      provider: 'Gmail OAuth',
      messages: [],
      error: erro.message,
    };
  }
}

/**
 * Serviço de E-mail aplicando Strategy Pattern de acordo com a credencial configurada.
 */
export const EmailService = {
  async fetchRecentEmails(config) {
    const emailAddress = config?.emailAddress || DEFAULT_USER_EMAIL;

    if (config?.appPassword) {
      return fetchViaImapBridgeStrategy(emailAddress, config.appPassword);
    }

    if (config?.webhookUrl) {
      return fetchViaWebhookStrategy(emailAddress, config.webhookUrl);
    }

    if (config?.gmailAccessToken || config?.accessToken) {
      return fetchViaGmailOAuthStrategy(
        emailAddress,
        config.gmailAccessToken || config.accessToken
      );
    }

    return {
      connected: false,
      provider: null,
      messages: [],
      error: null,
    };
  },

  async fetchUnreadEmails(config) {
    return this.fetchRecentEmails(config);
  },
};
