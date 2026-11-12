import React, { memo, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_USER_EMAIL } from '../../../core/config/constants';
import { colors, radii, spacing, typography } from '../../../core/theme/tokens';
import { EmailAccountEntity } from '../../../domain/entities/EmailAccount';

function EmailModalComponent({
  visible,
  onClose,
  emailConfig,
  onSaveConfig,
  onDisconnect,
}) {
  const [emailAddress, setEmailAddress] = useState(DEFAULT_USER_EMAIL);
  const [appPassword, setAppPassword] = useState('');
  const [gmailAccessToken, setGmailAccessToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (visible) {
      setEmailAddress(emailConfig?.emailAddress || DEFAULT_USER_EMAIL);
      setAppPassword(emailConfig?.appPassword || '');
      setGmailAccessToken(emailConfig?.gmailAccessToken || '');
      setWebhookUrl(emailConfig?.webhookUrl || '');
      setValidationError('');
    }
  }, [emailConfig, visible]);

  const handleSave = () => {
    const draft = EmailAccountEntity.normalize({
      emailAddress,
      appPassword,
      gmailAccessToken,
      webhookUrl,
    });

    const validation = EmailAccountEntity.validate(draft);
    if (!validation.valid) {
      setValidationError(validation.errorMessage);
      return;
    }

    setValidationError('');
    onSaveConfig(draft);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Vincular Conta de E-mail</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Para o Alfred ler os e-mails reais da sua caixa de entrada, preencha a{' '}
              <Text style={styles.highlightText}>Senha de App do Google</Text> abaixo (ou use Token OAuth / Webhook):
            </Text>

            {validationError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{validationError}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>SEU ENDEREÇO DE E-MAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="seu.email@gmail.com"
              placeholderTextColor={colors.text.muted}
              value={emailAddress}
              onChangeText={setEmailAddress}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>
                Opção 1: Senha de App do Gmail (Recomendado)
              </Text>
              <Text style={styles.optionHelper}>
                Acesse myaccount.google.com/apppasswords na sua conta Google, crie uma senha de app de 16 letras e cole aqui. O servidor local do Alfred sincronizará sua caixa de entrada via IMAP seguro.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="xxxx xxxx xxxx xxxx"
                placeholderTextColor={colors.text.muted}
                value={appPassword}
                onChangeText={setAppPassword}
                autoCapitalize="none"
                secureTextEntry
              />
            </View>

            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>Opção 2: Gmail OAuth Access Token</Text>
              <Text style={styles.optionHelper}>
                Se preferir conectar diretamente via API REST oficial do Gmail, cole um Access Token OAuth 2.0 (escopo gmail.readonly).
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Token OAuth 2.0 (gmail.readonly)"
                placeholderTextColor={colors.text.muted}
                value={gmailAccessToken}
                onChangeText={setGmailAccessToken}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>Opção 3: Google Apps Script / Webhook JSON</Text>
              <Text style={styles.optionHelper}>
                URL de Web App do Google Apps Script que retorne seus últimos e-mails em JSON.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="https://script.google.com/macros/s/.../exec"
                placeholderTextColor={colors.text.muted}
                value={webhookUrl}
                onChangeText={setWebhookUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Salvar e Sincronizar E-mail</Text>
              </TouchableOpacity>

              {emailConfig?.connected ? (
                <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect}>
                  <Text style={styles.disconnectBtnText}>Desvincular E-mail</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const EmailModal = memo(EmailModalComponent);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 18,
    color: colors.text.secondary,
  },
  description: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  highlightText: {
    color: colors.accent.secondary,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.status.recordingBg,
    borderWidth: 1,
    borderColor: colors.status.recording,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  label: {
    ...typography.labelCaps,
    color: colors.accent.secondary,
    marginBottom: spacing.xs,
  },
  optionBox: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  optionTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionHelper: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radii.sm,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  actions: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  saveBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  disconnectBtn: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.status.recording,
    borderRadius: radii.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectBtnText: {
    ...typography.button,
    color: colors.status.recording,
  },
});
