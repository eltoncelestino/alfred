import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../../core/theme/tokens';

function MessageItemComponent({ item, onReplayAudio, isSpeaking }) {
  const isUser = item.autor === 'Você';

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.texto}</Text>
          {item.timestamp ? <Text style={styles.userTimestamp}>{item.timestamp}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantCard}>
        <View style={styles.assistantHeader}>
          <View style={styles.assistantIdentity}>
            <View style={styles.monogramBadge}>
              <Text style={styles.monogramText}>A</Text>
            </View>
            <Text style={styles.assistantLabel}>ALFRED</Text>
            {item.timestamp ? (
              <Text style={styles.assistantTimestamp}>· {item.timestamp}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.replayButton}
            onPress={() => onReplayAudio?.(item.texto)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ouvir resposta novamente"
          >
            <Text style={styles.replayButtonText}>{isSpeaking ? 'Ouvindo' : 'Ouvir'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.assistantText}>{item.texto}</Text>
      </View>
    </View>
  );
}

export const MessageItem = memo(MessageItemComponent);

const styles = StyleSheet.create({
  userRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  userBubble: {
    maxWidth: layout.userBubbleMaxWidth,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radii.lg,
    borderBottomRightRadius: radii.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userText: {
    ...typography.body,
    color: colors.text.primary,
  },
  userTimestamp: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  assistantRow: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  assistantCard: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  assistantIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monogramBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.subtle,
    borderWidth: 1,
    borderColor: colors.border.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  monogramText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.secondary,
  },
  assistantLabel: {
    ...typography.labelCaps,
    color: colors.accent.secondary,
    marginRight: spacing.xs + 2,
  },
  assistantTimestamp: {
    ...typography.caption,
    color: colors.text.muted,
  },
  replayButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  replayButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  assistantText: {
    ...typography.body,
    color: colors.text.primary,
  },
});

