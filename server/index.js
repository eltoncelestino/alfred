const http = require('http');
const fs = require('fs');
const path = require('path');
const { synthesizeMaleNeuralPtBr, DEFAULT_MALE_VOICE } = require('./edge-tts');
const {
  loadSavedCredentials,
  saveCredentials,
  fetchGmailImap,
} = require('./imap-helper');
const { searchYouTubeVideos } = require('./youtube-helper');

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15 MB para suportar áudio base64 no /alfred-gemini

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let received = 0;

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(new Error('Payload excede o limite permitido.'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });

    req.on('error', reject);
  });
}

function getGeminiApiKey() {
  // Segurança: a chave é lida exclusivamente das variáveis de ambiente do servidor.
  return (
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_KEY ||
    ''
  ).trim();
}

function serveStaticFrontend(req, res) {
  const reqPath = (req.url || '/').split('?')[0];
  let safeRelPath = path.normalize(decodeURIComponent(reqPath)).replace(/^(\.\.[/\\])+/, '');
  if (safeRelPath === '/' || safeRelPath === '\\') {
    safeRelPath = 'index.html';
  }

  let filePath = path.join(DIST_DIR, safeRelPath);

  // Proteção contra Path Traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Fallback SPA para rotas do React Native / Expo Web
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend não encontrado. Execute "npx expo export --platform web".');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath.startsWith('/alfred-') && req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Healthcheck para Docker / Orquestradores
  if (urlPath === '/health' && req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'alfred-server',
      voice: DEFAULT_MALE_VOICE,
      geminiConfigured: Boolean(getGeminiApiKey()),
    });
    return;
  }

  // 1. Proxy seguro para Google Gemini API
  if (urlPath === '/alfred-gemini' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const model = payload.model || 'gemini-3.5-flash';
      const apiKey = getGeminiApiKey();
      const requestBody = payload.body || {};

      if (!apiKey) {
        sendJson(res, 500, {
          error: {
            status: 'FAILED_PRECONDITION',
            message: 'GEMINI_API_KEY não configurada no ambiente do servidor.',
          },
        });
        return;
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const upstream = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseText = await upstream.text();
      res.writeHead(upstream.status, {
        ...CORS_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(responseText);
    } catch (err) {
      sendJson(res, 502, {
        error: {
          status: 'UNAVAILABLE',
          message: `Erro ao consultar Gemini via servidor: ${err.message}`,
        },
      });
    }
    return;
  }

  // 2. Síntese de Voz Neural Masculina (pt-BR-AntonioNeural via Python edge-tts)
  if (urlPath === '/alfred-tts' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const text = String(payload.text || '').trim();
      if (!text) {
        sendJson(res, 400, { ok: false, erro: 'Texto vazio' });
        return;
      }
      const audioBuffer = await synthesizeMaleNeuralPtBr(text, DEFAULT_MALE_VOICE);
      sendJson(res, 200, {
        ok: true,
        voice: DEFAULT_MALE_VOICE,
        format: 'mp3',
        audioBase64: audioBuffer.toString('base64'),
      });
    } catch (err) {
      sendJson(res, 200, { ok: false, erro: err.message });
    }
    return;
  }

  // 3. Leitura de E-mails via IMAP
  if (urlPath === '/alfred-emails' && req.method === 'GET') {
    const creds = loadSavedCredentials();
    if (!creds.appPassword) {
      sendJson(res, 200, {
        conectado: false,
        email: creds.email || '',
        erro: 'Aguardando Senha de App ou Token no aplicativo.',
        emails: [],
      });
      return;
    }
    try {
      const emails = await fetchGmailImap(creds);
      sendJson(res, 200, { conectado: true, email: creds.email, emails });
    } catch (err) {
      sendJson(res, 200, {
        conectado: false,
        email: creds.email,
        erro: err.message,
        emails: [],
      });
    }
    return;
  }

  if (urlPath === '/alfred-emails' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const email = String(payload.email || '').trim();
      const appPassword = String(payload.appPassword || '').trim();
      const emails = await fetchGmailImap({ email, appPassword });
      saveCredentials({ email, appPassword });
      sendJson(res, 200, { conectado: true, email, emails });
    } catch (err) {
      sendJson(res, 200, { conectado: false, erro: err.message, emails: [] });
    }
    return;
  }

  // 4. Busca de Vídeos no YouTube
  if (urlPath === '/alfred-youtube' && req.method === 'GET') {
    try {
      const urlObj = new URL(req.url, `http://localhost:${PORT}`);
      const query = String(urlObj.searchParams.get('q') || '').trim();
      if (!query) {
        sendJson(res, 400, { ok: false, erro: 'Consulta vazia', videos: [] });
        return;
      }
      const videos = await searchYouTubeVideos(query);
      sendJson(res, 200, { ok: true, query, videos });
    } catch (err) {
      sendJson(res, 200, { ok: false, erro: err.message, videos: [] });
    }
    return;
  }

  // 5. Proxy RSS de Notícias (Google News Brasil / G1)
  if (urlPath === '/alfred-news' && req.method === 'GET') {
    const feeds = [
      'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
      'https://g1.globo.com/rss/g1/',
    ];
    for (const feedUrl of feeds) {
      try {
        const upstream = await fetch(feedUrl);
        const xml = await upstream.text();
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
    return;
  }

  // 6. Frontend Estático (dist/)
  serveStaticFrontend(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred Server] Produção rodando em http://0.0.0.0:${PORT}`);
});

function gracefulShutdown(signal) {
  console.log(`[Alfred Server] Encerrando (${signal})...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

