const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { synthesizeMaleNeuralPtBr, DEFAULT_MALE_VOICE } = require('./server/edge-tts');
const {
  loadSavedCredentials,
  saveCredentials,
  fetchGmailImap,
} = require('./server/imap-helper');

function detectLocalLanIp() {
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    return process.env.REACT_NATIVE_PACKAGER_HOSTNAME.trim();
  }
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (_) {}
  return 'localhost';
}

const lanHost = detectLocalLanIp();
if (!process.env.REACT_NATIVE_PACKAGER_HOSTNAME && lanHost !== 'localhost') {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanHost;
}

// Mantém o projeto "alfred" visível na lista do Expo Go na rede local
try {
  const {
    DevelopmentSession,
  } = require('./node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevelopmentSession');
  const announceToExpoGo = () => {
    const session = new DevelopmentSession(__dirname, `exp://${lanHost}:8081`);
    session.startAsync({ runtime: 'native' }).catch(() => {});
  };
  announceToExpoGo();
  setInterval(announceToExpoGo, 10000);
} catch (_) {}

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/alfred-tts') && req.method === 'POST') {
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

      if (req.url && req.url.startsWith('/alfred-emails') && req.method === 'GET') {
        (async () => {
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
        })();
        return;
      }

      if (req.url && req.url.startsWith('/alfred-emails') && req.method === 'POST') {
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

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
