/**
 * Cliente HTTP centralizado com controle de timeout seguro para React Native (iOS/Android),
 * evitando cancelamentos prematuros de XHR (Fetch request has been canceled).
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  let timerId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Timeout após ${timeoutMs}ms em ${url.split('?')[0]}`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([fetch(url, options), timeoutPromise]);
    return response;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}
