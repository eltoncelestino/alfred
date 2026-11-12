import React, { memo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../core/theme/tokens';

function ThinkingIndicatorComponent({ visible, stageText }) {
  if (!visible) return null;

  return (
    <View style={styles.thinkingRow}>
      <ActivityIndicator size="small" color={colors.accent.primary} />
      <Text style={styles.thinkingText}>
        {stageText || 'Alfred está respondendo...'}
      </Text>
    </View>
  );
}

export const ThinkingIndicator = memo(ThinkingIndicatorComponent);
export default ThinkingIndicator;

const styles = StyleSheet.create({
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  thinkingText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

