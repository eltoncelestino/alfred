import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

/**
 * Error Boundary global para capturar falhas de renderização inesperadas
 * e permitir recuperação imediata sem fechar o aplicativo.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Ocorreu um erro inesperado na interface.',
    };
  }

  componentDidCatch(error, info) {
    console.warn('[ErrorBoundary] Falha capturada:', error?.message, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.kicker}>RECUPERAÇÃO DO SISTEMA</Text>
            <Text style={styles.title}>Perdão, senhor. Houve uma falha visual.</Text>
            <Text style={styles.description}>{this.state.errorMessage}</Text>
            <Pressable onPress={this.handleReset} style={styles.button}>
              <Text style={styles.buttonText}>Restaurar Interface</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
    padding: spacing.xl,
    maxWidth: 420,
    width: '100%',
  },
  kicker: {
    ...typography.label,
    color: colors.accent.primary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.text.inverse,
    fontWeight: '700',
  },
});

