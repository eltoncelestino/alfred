const tls = require('tls');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = path.join(__dirname, 'email-credentials.json');
const DEFAULT_EMAIL = process.env.EXPO_PUBLIC_DEFAULT_USER_EMAIL || '';

function loadSavedCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    }
  } catch (_) {}
  return { email: DEFAULT_EMAIL, appPassword: '' };
}

function saveCredentials(creds) {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf8');
  } catch (_) {}
}

function decodeMimeWords(str) {
  if (!str) return '';
  return str
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
      try {
        if (encoding.toUpperCase() === 'B') {
          return Buffer.from(text, 'base64').toString('utf8');
        }
        if (encoding.toUpperCase() === 'Q') {
          const qText = text
            .replace(/_/g, ' ')
            .replace(/=([0-9A-Fa-f]{2})/g, (__, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          return Buffer.from(qText, 'binary').toString('utf8');
        }
      } catch (_) {}
      return text;
    })
    .replace(/\r?\n\s+/g, ' ')
    .trim();
}

function fetchGmailImap({ email, appPassword }) {
  return new Promise((resolve, reject) => {
    const cleanPass = (appPassword || '').replace(/\s+/g, '');
    if (!email || !cleanPass) {
      return reject(
        new Error('Informe a Senha de App de 16 letras do Google para sincronizar via IMAP.')
      );
    }

    const socket = tls.connect(
      { host: 'imap.gmail.com', port: 993, servername: 'imap.gmail.com' },
      () => {}
    );

    let buffer = '';
    let step = 'GREETING';
    let targetIds = [];
    const emails = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Tempo limite excedido ao conectar ao servidor IMAP do Gmail.'));
    }, 10000);

    function finish(err, result) {
      clearTimeout(timeout);
      try {
        socket.write('A99 LOGOUT\r\n');
        socket.end();
      } catch (_) {}
      if (err) reject(err);
      else resolve(result);
    }

    socket.on('error', (err) => finish(err));

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      if (step === 'GREETING' && buffer.includes('\r\n')) {
        buffer = '';
        step = 'LOGIN';
        socket.write(`A01 LOGIN "${email}" "${cleanPass}"\r\n`);
        return;
      }

      if (step === 'LOGIN') {
        if (buffer.includes('A01 OK')) {
          buffer = '';
          step = 'SELECT';
          socket.write('A02 EXAMINE INBOX\r\n');
        } else if (buffer.includes('A01 NO') || buffer.includes('A01 BAD')) {
          finish(
            new Error(
              'Falha de autenticação no Gmail. Verifique se você usou uma Senha de App de 16 caracteres (myaccount.google.com/apppasswords).'
            )
          );
        }
        return;
      }

      if (step === 'SELECT' && buffer.includes('A02 OK')) {
        buffer = '';
        step = 'SEARCH';
        socket.write('A03 SEARCH UNSEEN\r\n');
        return;
      }

      if (step === 'SEARCH' && buffer.includes('A03 OK')) {
        const match = buffer.match(/\* SEARCH([\d\s]*)\r\n/);
        buffer = '';
        if (match && match[1] && match[1].trim()) {
          const allIds = match[1].trim().split(/\s+/);
          targetIds = allIds.slice(-5).reverse();
        }
        if (targetIds.length === 0) {
          finish(null, []);
          return;
        }
        step = 'FETCH';
        const seqSet = targetIds.join(',');
        socket.write(
          `A04 FETCH ${seqSet} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n`
        );
        return;
      }

      if (step === 'FETCH' && (buffer.includes('A04 OK') || buffer.includes('A04 NO'))) {
        const blocks = buffer.split(/\* \d+ FETCH/);
        for (const block of blocks.slice(1)) {
          const fromMatch = block.match(/^From:\s*(.+)$/im);
          const subjMatch = block.match(/^Subject:\s*(.+)$/im);
          const fromRaw = fromMatch ? decodeMimeWords(fromMatch[1]) : 'Remetente';
          const subjectRaw = subjMatch ? decodeMimeWords(subjMatch[1]) : 'Sem assunto';
          emails.push({
            from: fromRaw.replace(/<[^>]+>/g, '').replace(/"/g, '').trim() || fromRaw,
            subject: subjectRaw,
            snippet: '',
          });
        }
        finish(null, emails);
      }
    });
  });
}

module.exports = {
  loadSavedCredentials,
  saveCredentials,
  fetchGmailImap,
};
