import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QUICK_ACTIONS } from '../../../core/config/constants';
import { colors, radii, spacing, typography } from '../../../core/theme/tokens';

function QuickActionsBarComponent({ onSelectAction, disabled }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.chip, disabled && styles.chipDisabled]}
            onPress={() => onSelectAction(action.prompt)}
            disabled={disabled}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.chipText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export const QuickActionsBar = memo(QuickActionsBarComponent);

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 1,
    minHeight: 38,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
});

