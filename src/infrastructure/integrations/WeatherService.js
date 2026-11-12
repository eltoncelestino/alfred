import * as Location from 'expo-location';
import { ENDPOINTS } from '../../core/config/constants';
import { fetchWithTimeout } from '../http/httpClient';

const WMO_CODES = {
  0: 'céu limpo e ensolarado',
  1: 'predominantemente limpo',
  2: 'parcialmente nublado',
  3: 'tempo encoberto',
  45: 'neblina',
  48: 'nevoeiro úmido',
  51: 'garoa leve',
  53: 'garoa moderada',
  55: 'garoa intensa',
  61: 'chuva fraca',
  63: 'chuva moderada',
  65: 'chuva forte',
  71: 'neve fraca',
  80: 'pancadas de chuva rápidas',
  81: 'pancadas de chuva moderadas',
  82: 'pancadas de chuva fortes',
  95: 'trovoadas isoladas',
  96: 'tempestade com possibilidade de granizo',
  99: 'tempestade forte',
};

/**
 * Serviço de Meteorologia em Tempo Real (GPS + Open-Meteo + Reverse Geocoding).
 */
export const WeatherService = {
  async fetchCurrentWeather() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      const [climaResp, geoResp] = await Promise.all([
        fetchWithTimeout(
          `${ENDPOINTS.openMeteoUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
          {},
          5500
        ),
        fetchWithTimeout(
          `${ENDPOINTS.reverseGeocodeUrl}?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
          {},
          4000
        ).catch(() => null),
      ]);

      const dadosClima = await climaResp.json();
      let cidade = 'Localização atual';
      if (geoResp && geoResp.ok) {
        const dadosGeo = await geoResp.json();
        cidade =
          dadosGeo.city ||
          dadosGeo.locality ||
          dadosGeo.principalSubdivision ||
          'Localização atual';
      }

      const atual = dadosClima.current || {};
      const diario = dadosClima.daily || {};

      const temperature = Math.round(atual.temperature_2m ?? 0);
      const apparentTemperature = Math.round(
        atual.apparent_temperature ?? temperature
      );
      const humidity = atual.relative_humidity_2m ?? 0;
      const windSpeed = Math.round(atual.wind_speed_10m ?? 0);
      const condition = WMO_CODES[atual.weather_code] || 'tempo estável';

      const maxTemp = Math.round(diario.temperature_2m_max?.[0] ?? temperature);
      const minTemp = Math.round(diario.temperature_2m_min?.[0] ?? temperature);
      const rainProbability = diario.precipitation_probability_max?.[0] ?? 0;

      return {
        ok: true,
        city: cidade,
        temperature,
        apparentTemperature,
        humidity,
        windSpeed,
        condition,
        maxTemp,
        minTemp,
        rainProbability,
        badge: `${temperature}°C · ${cidade}`,
      };
    } catch (erro) {
      console.warn('Erro ao buscar clima:', erro.message);
      return null;
    }
  },
};
