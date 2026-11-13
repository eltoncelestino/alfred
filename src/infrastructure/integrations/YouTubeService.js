import { Linking, Platform } from 'react-native';
import { ENDPOINTS } from '../../core/config/constants';
import { fetchWithTimeout } from '../http/httpClient';

/**
 * Serviço de integração real com o YouTube (busca de vídeos e abertura direta no app/navegador).
 */
export const YouTubeService = {
  async searchVideos(query) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return [];

    try {
      const resp = await fetchWithTimeout(
        `${ENDPOINTS.metroYoutube}?q=${encodeURIComponent(cleanQuery)}`,
        {},
        7000
      );
      const data = await resp.json();
      if (data?.ok && Array.isArray(data.videos)) {
        return data.videos;
      }
    } catch (err) {
      console.warn('[YouTubeService] Falha ao buscar vídeos:', err.message);
    }

    return [];
  },

  async openUrl(url) {
    if (!url) return false;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened) return true;
      }
      await Linking.openURL(url);
      return true;
    } catch (_) {
      return false;
    }
  },

  async searchAndOpen(query) {
    const cleanQuery = String(query || '').trim();
    const videos = await this.searchVideos(cleanQuery);
    const topVideo = videos[0] || null;

    const webUrl = topVideo
      ? topVideo.url
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;

    const appUrl = topVideo
      ? topVideo.appUrl
      : `youtube://results?search_query=${encodeURIComponent(cleanQuery)}`;

    let opened = false;
    if (Platform.OS === 'ios') {
      try {
        const canOpenApp = await Linking.canOpenURL(appUrl);
        if (canOpenApp) {
          await Linking.openURL(appUrl);
          opened = true;
        }
      } catch (_) {}
    }

    if (!opened) {
      opened = await this.openUrl(webUrl);
    }

    return {
      ok: true,
      opened,
      query: cleanQuery,
      video: topVideo,
      url: webUrl,
      title: topVideo?.title || `Buscar "${cleanQuery}" no YouTube`,
      channel: topVideo?.channel || 'YouTube',
    };
  },
};

