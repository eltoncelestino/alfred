import { ENDPOINTS } from '../../core/config/constants';
import { decodeXmlEntities } from '../../utils/formatters';
import { fetchWithTimeout } from '../http/httpClient';

/**
 * Serviço de Notícias em Tempo Real (Google News Brasil RSS / G1 RSS).
 */
export const NewsService = {
  async fetchTopHeadlines() {
    for (const url of ENDPOINTS.newsRssFeeds) {
      try {
        const response = await fetchWithTimeout(url, {}, 5500);
        const xml = await response.text();

        const itens = [];
        const regexItem = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = regexItem.exec(xml)) !== null && itens.length < 6) {
          const bloco = match[1];
          const tituloMatch = bloco.match(/<title>([\s\S]*?)<\/title>/);
          if (tituloMatch && tituloMatch[1]) {
            const tituloLimpo = decodeXmlEntities(tituloMatch[1]);
            if (tituloLimpo && !tituloLimpo.includes('Google Notícias')) {
              itens.push({ title: tituloLimpo });
            }
          }
        }

        if (itens.length > 0) {
          return itens;
        }
      } catch (erro) {
        console.warn(`Falha ao ler feed de notícias (${url}):`, erro.message);
      }
    }

    return [];
  },
};
