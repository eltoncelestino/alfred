import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../core/theme/tokens';

function ArmedListeningBannerComponent({ visible }) {
  if (!visible) return null;

  return (
    <View style={styles.armedBanner}>
      <View style={styles.armedDot} />
      <Text style={styles.armedBannerText}>
        Alfred está ouvindo você — diga sua instrução agora
      </Text>
    </View>
  );
}

export const ArmedListeningBanner = memo(ArmedListeningBannerComponent);
export default ArmedListeningBanner;

const styles = StyleSheet.create({
  armedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.subtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.accentSubtle,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  armedDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent.primary,
  },
  armedBannerText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
});

