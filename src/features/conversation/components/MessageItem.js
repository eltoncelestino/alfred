import React, { memo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../../core/theme/tokens';

function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  return false;
}

function MessageItemComponent({ item, onReplayAudio, isSpeaking }) {
  const [copied, setCopied] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const isUser = item.autor === 'Você';

  const handleCopyMessage = () => {
    const fullText = item.diagnosticError
      ? `${item.texto}\n\n[Diagnóstico]: ${item.diagnosticError}`
      : item.texto;
    copyTextToClipboard(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyDiagnostic = () => {
    if (!item.diagnosticError) return;
    copyTextToClipboard(item.diagnosticError);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 1800);
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text selectable style={styles.userText}>
            {item.texto}
          </Text>
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

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.replayButton}
              onPress={handleCopyMessage}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Copiar mensagem"
            >
              <Text style={styles.replayButtonText}>
                {copied ? 'Copiado!' : 'Copiar'}
              </Text>
            </TouchableOpacity>

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
        </View>

        <Text selectable style={styles.assistantText}>
          {item.texto}
        </Text>

        {item.youtubeAction?.url ? (
          <TouchableOpacity
            style={styles.youtubeCard}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open(item.youtubeAction.url, '_blank', 'noopener,noreferrer');
              } else {
                Linking.openURL(item.youtubeAction.url);
              }
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${item.youtubeAction.title} no YouTube`}
          >
            <View style={styles.youtubeBadge}>
              <Text style={styles.youtubeBadgeText}>▶</Text>
            </View>
            <View style={styles.youtubeInfo}>
              <Text style={styles.youtubeTitle} numberOfLines={1}>
                {item.youtubeAction.title}
              </Text>
              <Text style={styles.youtubeMeta} numberOfLines={1}>
                {item.youtubeAction.channel} · Toque para abrir no YouTube
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {item.diagnosticError ? (
          <View style={styles.diagnosticBox}>
            <View style={styles.diagnosticHeader}>
              <Text style={styles.diagnosticTitle}>DETALHE TÉCNICO DO ERRO</Text>
              <TouchableOpacity
                style={styles.diagnosticCopyBtn}
                onPress={handleCopyDiagnostic}
                activeOpacity={0.7}
              >
                <Text style={styles.diagnosticCopyText}>
                  {copiedDiag ? 'Copiado!' : 'Copiar erro'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text selectable style={styles.diagnosticText}>
              {item.diagnosticError}
            </Text>
          </View>
        ) : null}
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  diagnosticBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
  },
  diagnosticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  diagnosticTitle: {
    ...typography.labelCaps,
    color: colors.status.danger,
  },
  diagnosticCopyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.status.dangerBg,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
  },
  diagnosticCopyText: {
    ...typography.caption,
    color: colors.status.danger,
    fontWeight: '600',
  },
  diagnosticText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  youtubeCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.accent,
    gap: spacing.sm,
  },
  youtubeBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.status.dangerBg,
    borderWidth: 1,
    borderColor: colors.status.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeBadgeText: {
    color: colors.status.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  youtubeInfo: {
    flex: 1,
  },
  youtubeTitle: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  youtubeMeta: {
    ...typography.caption,
    color: colors.accent.secondary,
    marginTop: 2,
  },
});

