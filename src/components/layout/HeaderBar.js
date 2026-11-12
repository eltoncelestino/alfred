import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../core/theme/tokens';

function HeaderBarComponent({
  isSpeaking,
  isLoading,
  isListeningWakeWord,
  isCapturingSpeech,
  wakeWordArmed,
  weatherBadge,
  emailConnected,
  voiceMuted,
  handsFreeEnabled,
  onToggleHandsFree,
  onOpenEmailModal,
  onToggleMute,
  onStopSpeaking,
  hasMessages,
  onRestartMorning,
}) {
  let statusLabel = 'Pronto';
  let statusDotColor = colors.semantic.online;

  if (isLoading) {
    statusLabel = 'Processando...';
    statusDotColor = colors.semantic.warning;
  } else if (isSpeaking) {
    statusLabel = 'Alfred falando';
    statusDotColor = colors.semantic.speaking;
  } else if (wakeWordArmed) {
    statusLabel = 'Atento · Pode falar sua instrução';
    statusDotColor = colors.accent.primary;
  } else if (isCapturingSpeech) {
    statusLabel = 'Ouvindo chamada...';
    statusDotColor = colors.semantic.danger;
  } else if (handsFreeEnabled && isListeningWakeWord) {
    statusLabel = 'Standby · Chame "Alfred"';
    statusDotColor = colors.semantic.online;
  } else if (voiceMuted) {
    statusLabel = 'Voz silenciada';
    statusDotColor = colors.text.tertiary;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.inner}>
        {/* Linha 1: Identidade + Status à esquerda | Clima isolado à direita */}
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View
              style={[
                styles.monogram,
                wakeWordArmed && styles.monogramArmed,
                isCapturingSpeech && styles.monogramCapturing,
                isSpeaking && styles.monogramSpeaking,
              ]}
            >
              <Text style={styles.monogramText}>A</Text>
            </View>
            <View style={styles.brandTextCol}>
              <Text style={styles.title} accessibilityRole="header">
                Alfred
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: statusDotColor }]}
                />
                <Text style={styles.statusText} numberOfLines={1}>
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>

          {weatherBadge ? (
            <View style={styles.weatherPill}>
              <Text style={styles.weatherText} numberOfLines={1}>
                {weatherBadge}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Linha 2: Barra de controles espaçada */}
        <View style={styles.controlsRow}>
          <Pressable
            onPress={onOpenEmailModal}
            style={({ pressed }) => [
              styles.controlChip,
              emailConnected && styles.controlChipConnected,
              pressed && styles.controlChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Configurar ou vincular conta de e-mail"
          >
            <View
              style={[
                styles.chipDot,
                {
                  backgroundColor: emailConnected
                    ? colors.semantic.online
                    : colors.accent.primary,
                },
              ]}
            />
            <Text
              style={[
                styles.controlChipText,
                emailConnected && styles.controlChipTextHighlight,
              ]}
            >
              {emailConnected ? 'E-mail vinculado' : 'Vincular E-mail'}
            </Text>
          </Pressable>

          {isSpeaking ? (
            <Pressable
              onPress={onStopSpeaking}
              style={({ pressed }) => [
                styles.controlChip,
                styles.controlChipActive,
                pressed && styles.controlChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Interromper fala do Alfred"
            >
              <View style={styles.stopSquare} />
              <Text style={styles.controlChipTextActive}>Parar voz</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onToggleHandsFree}
              style={({ pressed }) => [
                styles.controlChip,
                handsFreeEnabled && styles.controlChipListening,
                pressed && styles.controlChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                handsFreeEnabled
                  ? 'Desativar ativação pelo nome Alfred'
                  : 'Ativar chamada pelo nome Alfred'
              }
            >
              <View
                style={[
                  styles.chipDot,
                  {
                    backgroundColor: handsFreeEnabled
                      ? colors.semantic.online
                      : colors.text.tertiary,
                  },
                ]}
              />
              <Text
                style={[
                  styles.controlChipText,
                  handsFreeEnabled && styles.controlChipTextHighlight,
                ]}
              >
                {handsFreeEnabled ? 'Escuta "Alfred": On' : 'Escuta: Manual'}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onToggleMute}
            style={({ pressed }) => [
              styles.controlChip,
              pressed && styles.controlChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              voiceMuted ? 'Ativar resposta por voz' : 'Silenciar resposta por voz'
            }
          >
            <Text style={styles.controlChipText}>
              {voiceMuted ? 'Som: Off' : 'Som: On'}
            </Text>
          </Pressable>

          {hasMessages && (
            <Pressable
              onPress={onRestartMorning}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.morningChip,
                pressed && styles.controlChipPressed,
                isLoading && styles.disabledChip,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Iniciar rotina matinal novamente"
            >
              <Text style={styles.morningChipText}>Briefing</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export const HeaderBar = memo(HeaderBarComponent);
export default HeaderBar;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  inner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.md,
  },
  brandTextCol: {
    flex: 1,
  },
  monogram: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.accent.subtle,
    borderWidth: 1,
    borderColor: colors.border.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  monogramArmed: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(214, 184, 138, 0.25)',
  },
  monogramCapturing: {
    borderColor: colors.semantic.danger,
    backgroundColor: colors.semantic.dangerSubtle,
  },
  monogramSpeaking: {
    borderColor: colors.accent.primary,
  },
  monogramText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent.primary,
    letterSpacing: 0.4,
  },
  title: {
    ...typography.subtitle,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    marginRight: 6,
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11.5,
  },
  weatherPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginLeft: spacing.sm,
  },
  weatherText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  controlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 6,
  },
  controlChipConnected: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  controlChipListening: {
    borderColor: 'rgba(52, 211, 153, 0.28)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  controlChipActive: {
    backgroundColor: colors.semantic.dangerSubtle,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  controlChipPressed: {
    opacity: 0.72,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  stopSquare: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: colors.semantic.danger,
  },
  controlChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
    fontSize: 11.5,
  },
  controlChipTextHighlight: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  controlChipTextActive: {
    ...typography.caption,
    color: colors.semantic.danger,
    fontWeight: '600',
    fontSize: 11.5,
  },
  morningChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.accent.subtle,
    borderWidth: 1,
    borderColor: colors.border.accentSubtle,
  },
  morningChipText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    fontSize: 11.5,
  },
  disabledChip: {
    opacity: 0.45,
  },
});

