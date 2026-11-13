/**
 * Helper de busca real no YouTube (sem necessidade de chave de API)
 * extraindo os principais resultados de vídeo do HTML público de pesquisa.
 */
function extractText(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) {
    return node.runs.map((r) => r.text || '').join('');
  }
  return '';
}

function collectVideoRenderers(obj, out = []) {
  if (!obj || typeof obj !== 'object' || out.length >= 5) return out;
  if (obj.videoRenderer && obj.videoRenderer.videoId) {
    const v = obj.videoRenderer;
    const videoId = v.videoId;
    out.push({
      videoId,
      title: extractText(v.title) || 'Vídeo no YouTube',
      channel: extractText(v.ownerText || v.longBylineText) || 'YouTube',
      duration: extractText(v.lengthText) || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      appUrl: `youtube://www.youtube.com/watch?v=${videoId}`,
    });
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectVideoRenderers(item, out);
      if (out.length >= 5) break;
    }
  } else {
    for (const key of Object.keys(obj)) {
      collectVideoRenderers(obj[key], out);
      if (out.length >= 5) break;
    }
  }
  return out;
}

async function searchYouTubeVideos(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    cleanQuery
  )}&hl=pt&gl=BR`;

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const html = await response.text();
  const match =
    html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) ||
    html.match(/ytInitialData"\s*:\s*(\{[\s\S]*?\})\s*,\s*"/);

  if (!match || !match[1]) {
    // Fallback por regex simples de videoId caso a estrutura da página mude
    const ids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(
      (m) => m[1]
    );
    const uniqueIds = [...new Set(ids)].slice(0, 5);
    return uniqueIds.map((videoId) => ({
      videoId,
      title: cleanQuery,
      channel: 'YouTube',
      duration: '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      appUrl: `youtube://www.youtube.com/watch?v=${videoId}`,
    }));
  }

  const data = JSON.parse(match[1]);
  return collectVideoRenderers(data, []);
}

module.exports = { searchYouTubeVideos };

