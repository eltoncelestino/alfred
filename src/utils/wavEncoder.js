/**
 * Adapter binário: converte áudio PCM 16-bit mono (base64) em arquivo RIFF WAV válido (base64)
 * compatível com AVAudioPlayer no iOS e MediaPlayer no Android.
 */
export function pcmBase64ToWavBase64(pcmBase64, sampleRate = 24000) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const clean = String(pcmBase64 || '').replace(/[^A-Za-z0-9+/]/g, '');
  const pad = pcmBase64.endsWith('==') ? 2 : pcmBase64.endsWith('=') ? 1 : 0;
  const pcmLen = Math.floor((clean.length * 3) / 4) - pad;

  const wavBuffer = new Uint8Array(44 + pcmLen);
  const view = new DataView(wavBuffer.buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      wavBuffer[offset + i] = str.charCodeAt(i);
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcmLen, true);

  let p = 44;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    if (p < 44 + pcmLen) wavBuffer[p++] = (e1 << 2) | (e2 >> 4);
    if (p < 44 + pcmLen) wavBuffer[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < 44 + pcmLen) wavBuffer[p++] = ((e3 & 3) << 6) | e4;
  }

  let out = '';
  const total = wavBuffer.length;
  for (let i = 0; i < total; i += 3) {
    const b1 = wavBuffer[i];
    const b2 = i + 1 < total ? wavBuffer[i + 1] : 0;
    const b3 = i + 2 < total ? wavBuffer[i + 2] : 0;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (b2 >> 4)];
    out += i + 1 < total ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < total ? chars[b3 & 63] : '=';
  }
  return out;
}

