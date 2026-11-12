const tls = require('tls');
const crypto = require('crypto');

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

// Voz masculina neural brasileira fixa e 100% consistente
const DEFAULT_MALE_VOICE = 'pt-BR-AntonioNeural';

function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const ticksIn100Ns = BigInt(ticks) * 10000000n;
  const strToHash = `${ticksIn100Ns.toString()}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createWsFrame(payload, opcode = 0x01) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const mask = crypto.randomBytes(4);
  const len = data.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    masked[i] = data[i] ^ mask[i % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

function synthesizeMaleNeuralPtBr(text, voice = DEFAULT_MALE_VOICE) {
  return new Promise((resolve, reject) => {
    const connId = crypto.randomUUID().replace(/-/g, '');
    const requestId = crypto.randomUUID().replace(/-/g, '');
    const secMsGec = generateSecMsGec();
    const wsKey = crypto.randomBytes(16).toString('base64');

    const host = 'speech.platform.bing.com';
    const pathUrl = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
      },
      () => {
        const handshake = [
          `GET ${pathUrl} HTTP/1.1`,
          `Host: ${host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${wsKey}`,
          'Sec-WebSocket-Version: 13',
          'Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION}`,
          '',
          '',
        ].join('\r\n');
        socket.write(handshake);
      }
    );

    let upgraded = false;
    let rawBuffer = Buffer.alloc(0);
    const audioChunks = [];
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        socket.destroy();
        reject(new Error('Timeout na síntese neural de voz'));
      }
    }, 12000);

    function done(err, result) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try {
        socket.end();
        socket.destroy();
      } catch (_) {}
      if (err) reject(err);
      else resolve(result);
    }

    socket.on('error', (err) => done(err));
    socket.on('close', () => {
      if (!finished) {
        if (audioChunks.length > 0) {
          done(null, Buffer.concat(audioChunks));
        } else {
          done(new Error('Conexão encerrada sem áudio'));
        }
      }
    });

    socket.on('data', (chunk) => {
      rawBuffer = Buffer.concat([rawBuffer, chunk]);

      if (!upgraded) {
        const headerEnd = rawBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerStr = rawBuffer.slice(0, headerEnd).toString('utf8');
        if (!headerStr.includes('101')) {
          done(new Error(`Falha no handshake WebSocket TTS: ${headerStr.split('\r\n')[0]}`));
          return;
        }

        upgraded = true;
        rawBuffer = rawBuffer.slice(headerEnd + 4);

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
          `<voice name='${voice}'>` +
          `<prosody pitch='-2Hz' rate='+2%' volume='+0%'>${escapeXml(text)}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${new Date().toISOString()}Z\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml;

        socket.write(createWsFrame(configMsg, 0x01));
        socket.write(createWsFrame(ssmlMsg, 0x01));
      }

      // Processa frames WebSocket recebidos
      while (rawBuffer.length >= 2) {
        const firstByte = rawBuffer[0];
        const secondByte = rawBuffer[1];
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rawBuffer.length < 4) return;
          payloadLen = rawBuffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rawBuffer.length < 10) return;
          payloadLen = Number(rawBuffer.readBigUInt64BE(2));
          offset = 10;
        }

        if (isMasked) offset += 4;
        if (rawBuffer.length < offset + payloadLen) return;

        const payload = rawBuffer.slice(offset, offset + payloadLen);
        rawBuffer = rawBuffer.slice(offset + payloadLen);

        if (opcode === 0x01) {
          // Texto
          const textFrame = payload.toString('utf8');
          if (textFrame.includes('Path:turn.end')) {
            done(null, Buffer.concat(audioChunks));
            return;
          }
        } else if (opcode === 0x02) {
          // Binário (áudio MP3)
          if (payload.length >= 2) {
            const headerLen = payload.readUInt16BE(0);
            const headerText = payload.slice(2, 2 + headerLen).toString('utf8');
            if (headerText.includes('Path:audio')) {
              const audioData = payload.slice(2 + headerLen);
              if (audioData.length > 0) {
                audioChunks.push(audioData);
              }
            }
          }
        } else if (opcode === 0x08) {
          // Close
          done(null, Buffer.concat(audioChunks));
          return;
        }
      }
    });
  });
}

module.exports = { synthesizeMaleNeuralPtBr, DEFAULT_MALE_VOICE };

