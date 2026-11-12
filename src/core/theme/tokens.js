import { Platform } from 'react-native';

/**
 * Alfred Design System — Tokens (2026 Edition)
 * Estética: Quiet Luxury / Editorial Dark (inspirado em Linear, Apple iOS e Stripe)
 * Contraste calibrado para WCAG 2.2 AA em ambientes matinais e noturnos.
 */

export const colors = {
  surface: {
    canvas: '#090B10',        // Fundo principal obsidiana
    elevated: '#10131C',      // Barra superior e área de composição
    card: '#141824',          // Superfícies de conteúdo do Alfred
    cardHover: '#191E2D',     // Estado pressionado / foco
    userMessage: '#1C2233',   // Mensagem do usuário
    pill: '#151926',          // Chips de ação rápida
    translucent: 'rgba(16, 19, 28, 0.88)',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.07)',
    default: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(214, 184, 138, 0.48)',
    accentSubtle: 'rgba(214, 184, 138, 0.24)',
  },
  text: {
    primary: '#F3F4F6',       // Branco suave de alta legibilidade
    secondary: '#9CA3AF',     // Cinza neutro para subtítulos e metadados
    tertiary: '#646D7E',      // Rótulos discretos e horários
    inverse: '#090B10',       // Texto escuro sobre botão primário
    accent: '#D6B88A',        // Champagne / Latão escovado
  },
  accent: {
    primary: '#D6B88A',       // Champagne metálico discreto
    primaryPressed: '#C4A574',
    subtle: 'rgba(214, 184, 138, 0.12)',
    glow: 'rgba(214, 184, 138, 0.06)',
  },
  semantic: {
    online: '#34D399',        // Indicador ativo / pronto
    speaking: '#D6B88A',      // Voz em reprodução
    warning: '#FBBF24',
    danger: '#F87171',
    dangerSubtle: 'rgba(248, 113, 113, 0.12)',
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
};

const fontFamilySans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  fontFamily: {
    sans: fontFamilySans,
    mono: fontFamilyMono,
  },
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
};

export const shadows = {
  subtle: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.24,
      shadowRadius: 12,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
};

export const layout = {
  maxContentWidth: 720,
};

