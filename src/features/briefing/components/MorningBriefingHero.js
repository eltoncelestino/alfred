import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../../../core/theme/tokens';
import { AgendaEventEntity } from '../../../domain/entities/AgendaEvent';
import { getEditorialGreeting } from '../../../utils/formatters';

function MorningBriefingHeroComponent({
  onStartDay,
  onSyncIntegrations,
  onOpenEmailModal,
  weatherData,
  newsData,
  emailConfig,
  emailSummary,
  agendaEvents = [],
  syncingIntegrations,
  disabled,
}) {
  const { greeting, subtitle } = getEditorialGreeting();
  const todayIso = AgendaEventEntity.getTodayIsoDate();
  const todayEvents = agendaEvents.filter((e) => e.date === todayIso);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>ROTINA MATINAL · PÓS-ALARME</Text>
          </View>

          <TouchableOpacity
            style={styles.syncButton}
            onPress={onSyncIntegrations}
            disabled={syncingIntegrations}
            activeOpacity={0.75}
          >
            <Text style={styles.syncButtonText}>
              {syncingIntegrations ? 'Sincronizando...' : '↻ Atualizar dados'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardTitle}>Despertador & Resumo do Dia</Text>
        <Text style={styles.cardDescription}>
          Diga <Text style={styles.highlightText}>"Alfred"</Text> para chamar seu mordomo ou acione a abertura matinal após encerrar o alarme do iPhone ou concluir a missão do Alarmy.
        </Text>

        <View style={styles.liveFeedsGrid}>
          {/* Weather Pill */}
          <View style={styles.feedCard}>
            <View style={styles.feedHeader}>
              <Text style={styles.feedCategory}>CLIMA LOCAL</Text>
              <View
                style={[
                  styles.feedDot,
                  { backgroundColor: weatherData ? colors.status.listening : colors.text.muted },
                ]}
              />
            </View>
            {weatherData ? (
              <>
                <Text style={styles.feedPrimaryText}>
                  {weatherData.temperature}°C · {weatherData.condition}
                </Text>
                <Text style={styles.feedSecondaryText} numberOfLines={1}>
                  {weatherData.city} (Máx {weatherData.maxTemp}° / Mín {weatherData.minTemp}°)
                </Text>
              </>
            ) : (
              <Text style={styles.feedSecondaryText}>
                {syncingIntegrations ? 'Obtendo localização e clima...' : 'Toque em Atualizar dados'}
              </Text>
            )}
          </View>

          {/* Agenda Pill */}
          <View style={[styles.feedCard, styles.feedCardSpaced]}>
            <View style={styles.feedHeader}>
              <Text style={styles.feedCategory}>AGENDA DE HOJE</Text>
              <View
                style={[
                  styles.feedDot,
                  {
                    backgroundColor:
                      todayEvents.length > 0 ? colors.status.listening : colors.accent.primary,
                  },
                ]}
              />
            </View>
            {todayEvents.length > 0 ? (
              todayEvents.slice(0, 2).map((evt) => (
                <Text key={evt.id} style={styles.feedPrimaryText} numberOfLines={1}>
                  {evt.time} · {evt.title}
                </Text>
              ))
            ) : (
              <Text style={styles.feedSecondaryText}>
                Agenda livre hoje · Peça ao Alfred para marcar um compromisso
              </Text>
            )}
          </View>

          {/* Email Pill */}
          <TouchableOpacity
            style={[styles.feedCard, styles.feedCardSpaced]}
            onPress={onOpenEmailModal}
            activeOpacity={0.8}
          >
            <View style={styles.feedHeader}>
              <Text style={styles.feedCategory}>CAIXA DE ENTRADA (E-MAIL)</Text>
              <View
                style={[
                  styles.feedDot,
                  {
                    backgroundColor: emailConfig?.connected
                      ? colors.status.listening
                      : colors.accent.primary,
                  },
                ]}
              />
            </View>
            {emailConfig?.connected ? (
              <>
                <Text style={styles.feedPrimaryText} numberOfLines={1}>
                  {emailConfig.emailAddress || 'Conta vinculada'}
                </Text>
                <Text style={styles.feedSecondaryText} numberOfLines={1}>
                  {emailSummary?.error
                    ? `Aviso: ${emailSummary.error}`
                    : emailSummary?.messages?.length > 0
                    ? `${emailSummary.messages.length} e-mails recentes (remetente + assunto)`
                    : 'Conectado · Toque para configurar'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.feedPrimaryText, { color: colors.accent.secondary }]}>
                  + Vincular meu E-mail
                </Text>
                <Text style={styles.feedSecondaryText}>
                  Conecte sua conta Gmail (Senha de App) ou Token para o Alfred ler seus e-mails
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* News Pill */}
          <View style={[styles.feedCard, styles.feedCardSpaced]}>
            <View style={styles.feedHeader}>
              <Text style={styles.feedCategory}>MANCHETES (ATÉ 3 ITENS)</Text>
              <View
                style={[
                  styles.feedDot,
                  {
                    backgroundColor:
                      newsData?.length > 0 ? colors.status.listening : colors.text.muted,
                  },
                ]}
              />
            </View>
            {newsData && newsData.length > 0 ? (
              newsData.slice(0, 3).map((item, idx) => (
                <Text key={idx} style={styles.newsHeadlineText} numberOfLines={1}>
                  • {item.title}
                </Text>
              ))
            ) : (
              <Text style={styles.feedSecondaryText}>
                {syncingIntegrations ? 'Buscando manchetes do dia...' : 'Aguardando sincronização'}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.ctaButton, disabled && styles.ctaButtonDisabled]}
          onPress={onStartDay}
          disabled={disabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Encerrar despertador e iniciar rotina matinal com Alfred"
        >
          <Text style={styles.ctaButtonText}>Despertador encerrado · Iniciar rotina</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const MorningBriefingHero = memo(MorningBriefingHeroComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  greeting: {
    ...typography.heroGreeting,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.accent,
    ...shadows.elevated,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.subtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.primary,
    marginRight: spacing.xs + 2,
  },
  badgeText: {
    ...typography.labelCaps,
    color: colors.accent.secondary,
    fontSize: 10,
  },
  syncButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  syncButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginBottom: spacing.xs + 2,
  },
  cardDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  highlightText: {
    color: colors.accent.secondary,
    fontWeight: '700',
  },
  liveFeedsGrid: {
    marginBottom: spacing.lg,
  },
  feedCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  feedCardSpaced: {
    marginTop: spacing.md,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  feedCategory: {
    ...typography.labelCaps,
    fontSize: 10,
    color: colors.text.muted,
  },
  feedDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  feedPrimaryText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  feedSecondaryText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  newsHeadlineText: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: radii.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  ctaArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});
