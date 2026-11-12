const http = require('http');
const { synthesizeMaleNeuralPtBr, DEFAULT_MALE_VOICE } = require('./edge-tts');
const {
  loadSavedCredentials,
  saveCredentials,
  fetchGmailImap,
} = require('./imap-helper');

const PORT = Number(process.env.ALFRED_BRIDGE_PORT) || 8082;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url.startsWith('/emails') && req.method === 'GET') {
    const creds = loadSavedCredentials();
    if (!creds.appPassword) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          conectado: false,
          email: creds.email || '',
          erro: 'Aguardando Senha de App ou Token no aplicativo.',
          emails: [],
        })
      );
      return;
    }

    try {
      const emails = await fetchGmailImap(creds);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ conectado: true, email: creds.email, emails }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          conectado: false,
          email: creds.email,
          erro: err.message,
          emails: [],
        })
      );
    }
    return;
  }

  if (req.url.startsWith('/emails') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = (payload.email || '').trim();
        const appPassword = (payload.appPassword || '').trim();

        const emails = await fetchGmailImap({ email, appPassword });
        saveCredentials({ email, appPassword });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ conectado: true, email, emails }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ conectado: false, erro: err.message, emails: [] }));
      }
    });
    return;
  }

  if (req.url.startsWith('/tts') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const text = (payload.text || '').trim();
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, erro: 'Texto vazio' }));
          return;
        }

        const audioBuffer = await synthesizeMaleNeuralPtBr(text, DEFAULT_MALE_VOICE);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: true,
            voice: DEFAULT_MALE_VOICE,
            format: 'mp3',
            audioBase64: audioBuffer.toString('base64'),
          })
        );
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Alfred Gmail/TTS Bridge ativo em http://0.0.0.0:${PORT}`);
});
