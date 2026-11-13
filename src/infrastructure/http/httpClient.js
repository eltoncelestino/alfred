import { Platform } from 'react-native';

/**
 * Executa requisição via XMLHttpRequest nativo (RCTNetworking no iOS/Android),
 * evitando o bug FetchRequestCanceledException ("Fetch request has been canceled")
 * do módulo experimental ExpoFetchModule no Expo SDK 58.
 */
function fetchViaNativeXhr(url, options = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = (options.method || 'GET').toUpperCase();

    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;

    const headers = options.headers || {};
    Object.keys(headers).forEach((key) => {
      if (headers[key] != null) {
        xhr.setRequestHeader(key, String(headers[key]));
      }
    });

    xhr.onload = () => {
      const responseText = typeof xhr.responseText === 'string' ? xhr.responseText : '';
      const status = xhr.status || 0;
      resolve({
        ok: status >= 200 && status < 300,
        status,
        text: async () => responseText,
        json: async () => {
          try {
            return JSON.parse(responseText || '{}');
          } catch (err) {
            throw new Error(
              `Resposta JSON inválida (HTTP ${status}): ${responseText.slice(0, 180)}`
            );
          }
        },
      });
    };

    xhr.onerror = () => {
      reject(new Error(`Falha de rede (XHR) ao acessar ${url.split('?')[0]}`));
    };

    xhr.ontimeout = () => {
      reject(new Error(`Timeout após ${timeoutMs}ms em ${url.split('?')[0]}`));
    };

    xhr.onabort = () => {
      reject(new Error(`Requisição abortada em ${url.split('?')[0]}`));
    };

    try {
      xhr.send(options.body ?? null);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Cliente HTTP centralizado com controle de timeout seguro para Web, iOS e Android.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  if (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    typeof XMLHttpRequest !== 'undefined'
  ) {
    return fetchViaNativeXhr(url, options, timeoutMs);
  }

  let timerId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Timeout após ${timeoutMs}ms em ${url.split('?')[0]}`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([fetch(url, options), timeoutPromise]);
    return response;
  } catch (err) {
    if (typeof XMLHttpRequest !== 'undefined') {
      return fetchViaNativeXhr(url, options, timeoutMs);
    }
    throw err;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}

