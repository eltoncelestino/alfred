import * as FileSystem from 'expo-file-system/legacy';
import { ENDPOINTS, VOICE_CONFIG } from '../../core/config/constants';
import { fetchWithTimeout } from '../http/httpClient';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

function sha256AsciiHex(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result.toUpperCase();
}

function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const strToHash = `${ticks}0000000${TRUSTED_CLIENT_TOKEN}`;
  return sha256AsciiHex(strToHash);
}

function randomHex(len = 32) {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function uint8ArrayToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  let i = 0;
  while (i < len) {
    const a = bytes[i++];
    const b = i < len ? bytes[i++] : 0;
    const c = i < len ? bytes[i++] : 0;
    const triplet = (a << 16) | (b << 8) | c;

    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i > len + 1 ? '=' : chars[(triplet >> 6) & 0x3f];
    result += i > len ? '=' : chars[triplet & 0x3f];
  }
  const mod = len % 3;
  if (mod === 1) {
    result = result.slice(0, -2) + '==';
  } else if (mod === 2) {
    result = result.slice(0, -1) + '=';
  }
  return result;
}

function asciiBytesToString(uint8) {
  let out = '';
  for (let i = 0; i < uint8.length; i++) {
    out += String.fromCharCode(uint8[i]);
  }
  return out;
}

function synthesizeDirectOnDevice(text) {
  return new Promise((resolve, reject) => {
    const connId = randomHex(32);
    const reqId = randomHex(32);
    const secMsGec = generateSecMsGec();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl, undefined, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION}`,
        },
      });
    } catch (err) {
      reject(err);
      return;
    }

    ws.binaryType = 'arraybuffer';
    const chunks = [];
    let totalLen = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch (_) {}
        reject(new Error('Timeout WebSocket TTS'));
      }
    }, 8500);

    function finish(err, base64) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {}
      if (err) reject(err);
      else resolve(base64);
    }

    ws.onopen = () => {
      const configMsg =
        `X-Timestamp:${new Date().toISOString()}\r\n` +
        'Content-Type:application/json; charset=utf-8\r\n' +
        'Path:speech.config\r\n\r\n' +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false',
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        });

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
        `<voice name='${VOICE_CONFIG.neuralMaleVoice}'>` +
        `<prosody pitch='-2Hz' rate='+2%' volume='+0%'>${escapeXml(text)}</prosody>` +
        `</voice></speak>`;

      const ssmlMsg =
        `X-RequestId:${reqId}\r\n` +
        'Content-Type:application/ssml+xml\r\n' +
        `X-Timestamp:${new Date().toISOString()}Z\r\n` +
        'Path:ssml\r\n\r\n' +
        ssml;

      ws.send(configMsg);
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          if (totalLen === 0) {
            finish(new Error('Sem dados de áudio retornados'));
            return;
          }
          const combined = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          finish(null, uint8ArrayToBase64(combined));
        }
      } else if (event.data instanceof ArrayBuffer) {
        const buf = event.data;
        if (buf.byteLength < 2) return;
        const view = new DataView(buf);
        const headerLen = view.getUint16(0, false);
        if (buf.byteLength <= 2 + headerLen) return;
        const headerBytes = new Uint8Array(buf, 2, headerLen);
        const headerStr = asciiBytesToString(headerBytes);
        if (headerStr.includes('Path:audio')) {
          const audioBytes = new Uint8Array(buf, 2 + headerLen);
          if (audioBytes.length > 0) {
            chunks.push(audioBytes);
            totalLen += audioBytes.length;
          }
        }
      }
    };

    ws.onerror = () => {
      finish(new Error('Erro na conexão WebSocket TTS'));
    };

    ws.onclose = () => {
      if (!settled) {
        if (totalLen > 0) {
          const combined = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          finish(null, uint8ArrayToBase64(combined));
        } else {
          finish(new Error('WebSocket fechado antes do áudio'));
        }
      }
    };
  });
}

/**
 * Engine de síntese de voz neural masculina única (pt-BR-AntonioNeural).
 */
export async function sintetizarVozMasculinaUnica(texto, messageId) {
  // 1. Tenta via servidor Metro Bundler na porta 8081 (IP detectado via EXPO_PUBLIC_PACKAGER_HOSTNAME / stack)
  try {
    const resp = await fetchWithTimeout(
      ENDPOINTS.metroTts,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
      },
      15000
    );
    const data = await resp.json();
    if (data?.ok && data?.audioBase64) {
      if (!FileSystem.cacheDirectory) {
        return `data:audio/mp3;base64,${data.audioBase64}`;
      }
      const fileUri = `${FileSystem.cacheDirectory}alfred_voz_${messageId}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileUri;
    }
  } catch (_) {}

  // 2. Síntese direta no próprio iPhone via WebSocket seguro (porta 443) com a mesma voz pt-BR-AntonioNeural
  try {
    const base64Mp3 = await synthesizeDirectOnDevice(texto);
    if (base64Mp3) {
      if (!FileSystem.cacheDirectory) {
        return `data:audio/mp3;base64,${base64Mp3}`;
      }
      const fileUri = `${FileSystem.cacheDirectory}alfred_voz_${messageId}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Mp3, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileUri;
    }
  } catch (_) {}

  return null;
}
