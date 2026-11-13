import React, { memo } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../../core/theme/tokens';
import { formatDurationSeconds } from '../../../utils/formatters';

const COMPOSER_CONTROL_HEIGHT = Math.max(layout.minTouchTarget, 48);

function ComposerBarComponent({
  inputText,
  onChangeText,
  onSendText,
  isRecording,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  isBusy,
}) {
  const hasTypedText = inputText.trim().length > 0;

  return (
    <View style={styles.composerWrapper}>
      {isRecording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recordingIndicatorGroup}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Gravando comando de voz</Text>
          </View>
          <Text style={styles.recordingTimer}>{formatDurationSeconds(recordingSeconds)}</Text>
        </View>
      ) : null}

      <View style={styles.composerContainer}>
        <TextInput
          style={styles.input}
          placeholder="Peça algo ao Alfred ou diga 'Alfred'..."
          placeholderTextColor={colors.text.muted}
          value={inputText}
          onChangeText={onChangeText}
          editable={!isRecording}
          multiline
          numberOfLines={1}
          maxLength={600}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={onSendText}
        />

        {hasTypedText && !isRecording ? (
          <TouchableOpacity
            style={[styles.primaryActionBtn, isBusy && styles.actionBtnDisabled]}
            onPress={onSendText}
            disabled={isBusy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
          >
            <Text style={styles.primaryActionText}>Enviar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.voiceActionBtn,
              isRecording && styles.voiceActionBtnRecording,
              isBusy && !isRecording && styles.actionBtnDisabled,
            ]}
            onPress={isRecording ? onStopRecording : onStartRecording}
            disabled={isBusy && !isRecording}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? 'Parar gravação e enviar' : 'Iniciar gravação de voz'
            }
          >
            <View
              style={[
                styles.micIndicator,
                isRecording && styles.micIndicatorRecording,
              ]}
            />
            <Text
              style={[
                styles.voiceActionText,
                isRecording && styles.voiceActionTextRecording,
              ]}
            >
              {isRecording ? 'Enviar voz' : 'Falar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export const ComposerBar = memo(ComposerBarComponent);

const styles = StyleSheet.create({
  composerWrapper: {
    backgroundColor: colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.status.recordingBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  recordingIndicatorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.status.recording,
    marginRight: spacing.sm,
  },
  recordingText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  recordingTimer: {
    ...typography.monoTimer,
    color: colors.status.recording,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_CONTROL_HEIGHT,
    maxHeight: 112,
    backgroundColor: colors.bg.tertiary,
    color: colors.text.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.lg,
    paddingTop: 13,
    paddingBottom: 13,
    ...typography.bodySmall,
    marginRight: spacing.sm,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          boxSizing: 'border-box',
        }
      : null),
  },
  primaryActionBtn: {
    height: COMPOSER_CONTROL_HEIGHT,
    paddingHorizontal: spacing.lg + 2,
    borderRadius: radii.md,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  voiceActionBtn: {
    height: COMPOSER_CONTROL_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceActionBtnRecording: {
    backgroundColor: colors.status.recording,
    borderColor: colors.status.recording,
  },
  micIndicator: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.primary,
    marginRight: spacing.sm,
  },
  micIndicatorRecording: {
    backgroundColor: colors.text.primary,
  },
  voiceActionText: {
    ...typography.button,
    color: colors.accent.secondary,
  },
  voiceActionTextRecording: {
    color: colors.text.primary,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
});

