const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { synthesizeMaleNeuralPtBr, DEFAULT_MALE_VOICE } = require('./server/edge-tts');
const {
  loadSavedCredentials,
  saveCredentials,
  fetchGmailImap,
} = require('./server/imap-helper');
const { searchYouTubeVideos } = require('./server/youtube-helper');

function detectLocalLanIp() {
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    return process.env.REACT_NATIVE_PACKAGER_HOSTNAME.trim();
  }
  try {
    const interfaces = os.networkInterfaces();
    const names = Object.keys(interfaces);
    // Prioriza adaptadores Wi-Fi / Wireless reais sobre adaptadores virtuais (WSL / Hyper-V)
    const sortedNames = names.sort((a, b) => {
      const aWifi = /wi-?fi|wlan|wireless/i.test(a) ? -1 : 1;
      const bWifi = /wi-?fi|wlan|wireless/i.test(b) ? -1 : 1;
      return aWifi - bWifi;
    });
    for (const name of sortedNames) {
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

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/alfred-') && req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (req.url && req.url.startsWith('/alfred-gemini') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const model = payload.model || 'gemini-3.5-flash-lite';
            const apiKey = (
              payload.apiKey ||
              process.env.EXPO_PUBLIC_GEMINI_KEY ||
              ''
            ).trim();
            const requestBody = payload.body || {};

            if (!apiKey) {
              res.writeHead(400, CORS_HEADERS);
              res.end(
                JSON.stringify({
                  error: {
                    status: 'INVALID_ARGUMENT',
                    message:
                      'EXPO_PUBLIC_GEMINI_KEY não está configurada no arquivo .env.local.',
                  },
                })
              );
              return;
            }

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const upstream = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            const text = await upstream.text();
            if (!upstream.ok) {
              console.warn(
                `[Metro /alfred-gemini] Modelo ${model} retornou HTTP ${upstream.status}:`,
                text.slice(0, 300)
              );
            }
            res.writeHead(upstream.status, CORS_HEADERS);
            res.end(text);
          } catch (err) {
            console.error('[Metro /alfred-gemini] Erro de proxy:', err.message);
            res.writeHead(502, CORS_HEADERS);
            res.end(
              JSON.stringify({
                error: {
                  status: 'UNAVAILABLE',
                  message: `Falha ao conectar à API Gemini pelo servidor local: ${err.message}`,
                },
              })
            );
          }
        });
        return;
      }

      if (req.url && req.url.startsWith('/alfred-youtube') && req.method === 'GET') {
        (async () => {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const query = (urlObj.searchParams.get('q') || '').trim();
            if (!query) {
              res.writeHead(400, CORS_HEADERS);
              res.end(JSON.stringify({ ok: false, erro: 'Consulta vazia', videos: [] }));
              return;
            }
            const videos = await searchYouTubeVideos(query);
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify({ ok: true, query, videos }));
          } catch (err) {
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify({ ok: false, erro: err.message, videos: [] }));
          }
        })();
        return;
      }

      if (req.url && req.url.startsWith('/alfred-news') && req.method === 'GET') {
        (async () => {
          const feeds = [
            'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
            'https://g1.globo.com/rss/g1/',
          ];
          for (const feedUrl of feeds) {
            try {
              const r = await fetch(feedUrl);
              const xml = await r.text();
              if (xml && xml.includes('<item>')) {
                res.writeHead(200, {
                  ...CORS_HEADERS,
                  'Content-Type': 'application/xml; charset=utf-8',
                });
                res.end(xml);
                return;
              }
            } catch (_) {}
          }
          res.writeHead(200, {
            ...CORS_HEADERS,
            'Content-Type': 'application/xml; charset=utf-8',
          });
          res.end('<rss><channel></channel></rss>');
        })();
        return;
      }

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
              res.writeHead(400, CORS_HEADERS);
              res.end(JSON.stringify({ ok: false, erro: 'Texto vazio' }));
              return;
            }
            const audioBuffer = await synthesizeMaleNeuralPtBr(text, DEFAULT_MALE_VOICE);
            res.writeHead(200, CORS_HEADERS);
            res.end(
              JSON.stringify({
                ok: true,
                voice: DEFAULT_MALE_VOICE,
                format: 'mp3',
                audioBase64: audioBuffer.toString('base64'),
              })
            );
          } catch (err) {
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify({ ok: false, erro: err.message }));
          }
        });
        return;
      }

      if (req.url && req.url.startsWith('/alfred-emails') && req.method === 'GET') {
        (async () => {
          const creds = loadSavedCredentials();
          if (!creds.appPassword) {
            res.writeHead(200, CORS_HEADERS);
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
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify({ conectado: true, email: creds.email, emails }));
          } catch (err) {
            res.writeHead(200, CORS_HEADERS);
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
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify({ conectado: true, email, emails }));
          } catch (err) {
            res.writeHead(200, CORS_HEADERS);
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
