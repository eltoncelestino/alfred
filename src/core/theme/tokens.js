import { Platform } from 'react-native';

/**
 * Alfred Design System — Tokens Unificados (Obsidian & Warm Brass)
 * Contraste calibrado para WCAG 2.2 AA/AAA em ambientes matinais e noturnos.
 */

export const colors = {
  bg: {
    primary: '#090B10',       // Fundo principal obsidiana
    secondary: '#10131C',     // Cards, barra superior e área de composição
    tertiary: '#151926',      // Inputs, chips e sub-cards
    elevated: '#181E2D',      // Superfícies destacadas
    overlay: 'rgba(5, 7, 11, 0.78)', // Backdrop de modais
  },
  surface: {
    canvas: '#090B10',
    elevated: '#10131C',
    card: '#141824',
    cardHover: '#191E2D',
    userMessage: '#1C2233',
    pill: '#151926',
    translucent: 'rgba(16, 19, 28, 0.88)',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    default: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.16)',
    accent: 'rgba(214, 184, 138, 0.35)',
    focus: 'rgba(214, 184, 138, 0.48)',
    accentSubtle: 'rgba(214, 184, 138, 0.24)',
  },
  text: {
    primary: '#F3F4F6',       // Branco suave de alta legibilidade
    secondary: '#9CA3AF',     // Cinza neutro para subtítulos e metadados
    tertiary: '#646D7E',      // Rótulos discretos e horários
    muted: '#64748B',         // Placeholders e textos secundários discretos
    inverse: '#090B10',       // Texto escuro sobre botão primário
    accent: '#D6B88A',        // Champagne / Latão escovado
  },
  accent: {
    primary: '#D6B88A',       // Champagne metálico discreto
    secondary: '#E5C158',     // Dourado claro para destaques tipográficos
    primaryPressed: '#C4A574',
    subtle: 'rgba(214, 184, 138, 0.14)',
    glow: 'rgba(214, 184, 138, 0.06)',
  },
  status: {
    listening: '#34D399',     // Escuta ativa / conectado
    speaking: '#D6B88A',      // Voz do Alfred ativa
    processing: '#FBBF24',    // Sincronizando / pensando
    recording: '#EF4444',     // Gravação manual ativa
    recordingBg: 'rgba(239, 68, 68, 0.14)',
  },
  semantic: {
    online: '#34D399',
    speaking: '#D6B88A',
    warning: '#FBBF24',
    danger: '#F87171',
    dangerSubtle: 'rgba(248, 113, 113, 0.12)',
  },
};

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
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
  pill: 9999,
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
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  heroGreeting: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
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
  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelCaps: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  monoTimer: {
    fontFamily: fontFamilyMono,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
  elevated: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};

export const layout = {
  maxContentWidth: 720,
  minTouchTarget: 46,
  userBubbleMaxWidth: '82%',
};
