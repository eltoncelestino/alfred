import React, { useCallback, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { HeaderBar } from '../components/layout/HeaderBar';
import { ArmedListeningBanner } from '../components/ui/ArmedListeningBanner';
import { ThinkingIndicator } from '../components/ui/ThinkingIndicator';
import { colors, spacing } from '../core/theme/tokens';
import { MorningBriefingHero } from '../features/briefing/components/MorningBriefingHero';
import { QuickActionsBar } from '../features/briefing/components/QuickActionsBar';
import { ComposerBar } from '../features/conversation/components/ComposerBar';
import { MessageItem } from '../features/conversation/components/MessageItem';
import { useAlfredAssistant } from '../features/conversation/hooks/useAlfredAssistant';
import { EmailModal } from '../features/email/components/EmailModal';
import { useVoiceCommandSystem } from '../features/voice/hooks/useVoiceCommandSystem';

export function AssistantScreen() {
  const flatListRef = useRef(null);
  const restartHandsFreeRef = useRef(null);

  const handleAfterAssistantCycle = useCallback(() => {
    restartHandsFreeRef.current?.();
  }, []);

  const {
    messages,
    setMessages,
    inputText,
    setInputText,
    isLoading,
    setIsLoading,
    loadingStage,
    setLoadingStage,
    isSpeaking,
    isBusyRef,
    isSpeakingRef,
    weatherData,
    newsData,
    agendaEvents,
    emailConfig,
    emailSummary,
    syncingIntegrations,
    emailModalVisible,
    setEmailModalVisible,
    syncAllIntegrations,
    handleSaveEmailConfig,
    handleDisconnectEmail,
    stopSpeaking,
    speakText,
    speakWakeWordGreeting,
    executeCommand,
    startMorningRoutine,
  } = useAlfredAssistant({
    onAfterAssistantCycle: handleAfterAssistantCycle,
  });

  const {
    isRecording,
    recordingSeconds,
    handsFreeEnabled,
    isHandsFreeListening,
    wakeWordArmed,
    startHandsFreeMonitoring,
    toggleHandsFree,
    startManualRecording,
    stopManualRecording,
  } = useVoiceCommandSystem({
    isBusyRef,
    isSpeakingRef,
    stopSpeaking,
    speakText,
    speakWakeWordGreeting,
    executeCommand,
    setMessages,
    setIsLoading,
    setLoadingStage,
  });

  restartHandsFreeRef.current = startHandsFreeMonitoring;

  const isBusy = isLoading || isRecording;

  const handleOpenEmailModal = useCallback(() => {
    setEmailModalVisible(true);
  }, [setEmailModalVisible]);

  const handleCloseEmailModal = useCallback(() => {
    setEmailModalVisible(false);
  }, [setEmailModalVisible]);

  const handleSendText = useCallback(() => {
    executeCommand(inputText);
  }, [executeCommand, inputText]);

  const handleSelectQuickAction = useCallback(
    (prompt) => {
      executeCommand(prompt);
    },
    [executeCommand]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item }) => (
      <MessageItem
        item={item}
        onReplayAudio={speakText}
        isSpeaking={isSpeaking}
      />
    ),
    [isSpeaking, speakText]
  );

  const renderListHeader = useCallback(
    () => (
      <MorningBriefingHero
        onStartDay={startMorningRoutine}
        onSyncIntegrations={() => syncAllIntegrations()}
        onOpenEmailModal={handleOpenEmailModal}
        weatherData={weatherData}
        newsData={newsData}
        agendaEvents={agendaEvents}
        emailConfig={emailConfig}
        emailSummary={emailSummary}
        syncingIntegrations={syncingIntegrations}
        disabled={isBusy}
      />
    ),
    [
      agendaEvents,
      emailConfig,
      emailSummary,
      handleOpenEmailModal,
      isBusy,
      newsData,
      startMorningRoutine,
      syncAllIntegrations,
      syncingIntegrations,
      weatherData,
    ]
  );

  const renderListFooter = useCallback(
    () => <ThinkingIndicator visible={isLoading} stageText={loadingStage} />,
    [isLoading, loadingStage]
  );

  const handleScrollToEnd = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <View style={styles.root}>
      <HeaderBar
        isLoading={isLoading}
        isRecording={isRecording}
        isCapturingSpeech={isRecording}
        isSpeaking={isSpeaking}
        onStopSpeaking={stopSpeaking}
        handsFreeEnabled={handsFreeEnabled}
        isHandsFreeListening={isHandsFreeListening}
        isListeningWakeWord={isHandsFreeListening}
        wakeWordArmed={wakeWordArmed}
        onToggleHandsFree={toggleHandsFree}
        weatherBadge={weatherData?.badge}
        emailConnected={Boolean(emailConfig?.connected)}
        onOpenEmailModal={handleOpenEmailModal}
        hasMessages={messages.length > 1}
        onRestartMorning={startMorningRoutine}
      />

      <ArmedListeningBanner visible={wakeWordArmed && !isLoading} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleScrollToEnd}
          ListHeaderComponent={renderListHeader}
          renderItem={renderMessageItem}
          ListFooterComponent={renderListFooter}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
        />

        <QuickActionsBar
          onSelectAction={handleSelectQuickAction}
          disabled={isBusy}
        />

        <ComposerBar
          inputText={inputText}
          onChangeText={setInputText}
          onSendText={handleSendText}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
          onStartRecording={startManualRecording}
          onStopRecording={stopManualRecording}
          isBusy={isBusy}
        />
      </KeyboardAvoidingView>

      <EmailModal
        visible={emailModalVisible}
        onClose={handleCloseEmailModal}
        emailConfig={emailConfig}
        onSaveConfig={handleSaveEmailConfig}
        onDisconnect={handleDisconnectEmail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  keyboardContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
});
