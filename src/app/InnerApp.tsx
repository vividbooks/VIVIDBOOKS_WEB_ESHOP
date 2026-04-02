import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { useApp } from '@/app/contexts/AppContext';
import { ResponsiveLayout, type AssistantTabId } from '@/app/components/Layout';
import { DictationTab } from '@/app/components/tabs/DictationTab';
import { TasksTab } from '@/app/components/tabs/TasksTab';
import { AgentTab } from '@/app/components/tabs/AgentTab';
import { OutreachTab } from '@/app/components/tabs/OutreachTab';
import { ScrapingTab } from '@/app/components/tabs/ScrapingTab';
import { SettingsTab } from '@/app/components/tabs/SettingsTab';
import { MapTab } from '@/app/components/tabs/MapTab';
import { AssistantLoginScreen } from '@/app/components/AssistantLoginScreen';
import { Onboarding } from '@/app/components/Onboarding';
import { isAssistantEmailAllowed } from '@/config/assistantAllowlist';

type PendingAgentMessage = { text: string; nonce: string; fromDictation?: boolean } | null;

const ACCESS_DENIED_MSG = 'Tento účet nemá přístup k asistentovi.';

export const InnerApp: React.FC = () => {
  const { user, authReady, signOut } = useApp();
  const [currentTab, setCurrentTab] = useState<AssistantTabId>('dictation');
  const [pendingAgentMessage, setPendingAgentMessage] = useState<PendingAgentMessage>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Sync Google provider tokens from Supabase session only — never strip the OAuth
  // callback hash here; doing so before supabase.auth.initialize() runs prevents
  // the sb-*-auth-token session from being created (user stays null).
  useEffect(() => {
    if (!authReady) return;
    const syncProviderTokens = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.provider_token) localStorage.setItem('google_provider_token', session.provider_token);
        if (session?.provider_refresh_token) localStorage.setItem('google_provider_refresh_token', session.provider_refresh_token);
      } catch (e) {
        console.log('Session check skipped:', e);
      }
    };
    void syncProviderTokens();
  }, [authReady, user?.id]);

  useEffect(() => {
    const metaCapable = document.createElement('meta');
    metaCapable.name = 'apple-mobile-web-app-capable';
    metaCapable.content = 'yes';
    document.head.appendChild(metaCapable);

    const metaStatus = document.createElement('meta');
    metaStatus.name = 'apple-mobile-web-app-status-bar-style';
    metaStatus.content = 'black';
    document.head.appendChild(metaStatus);

    const linkIcon = document.createElement('link');
    linkIcon.rel = 'apple-touch-icon';
    linkIcon.href = `${import.meta.env.BASE_URL}icon.png`;
    document.head.appendChild(linkIcon);

    return () => {
      if (document.head.contains(metaCapable)) document.head.removeChild(metaCapable);
      if (document.head.contains(metaStatus)) document.head.removeChild(metaStatus);
      if (document.head.contains(linkIcon)) document.head.removeChild(linkIcon);
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user?.email) {
      setShowOnboarding(false);
      return;
    }
    if (isAssistantEmailAllowed(user.email)) {
      setAccessDeniedMessage(null);
      const hasOnboarded = localStorage.getItem('dictation_app_onboarded');
      setShowOnboarding(!hasOnboarded);
      return;
    }
    setAccessDeniedMessage(ACCESS_DENIED_MSG);
    setShowOnboarding(false);
    void signOut();
  }, [authReady, user, signOut]);

  useEffect(() => {
    if (currentTab !== 'agent') setPendingAgentMessage(null);
  }, [currentTab]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('dictation_app_onboarded', 'true');
    setShowOnboarding(false);
  };

  const sendDictationToAssistant = (wrappedMessage: string) => {
    const payload: NonNullable<PendingAgentMessage> = {
      text: wrappedMessage,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      fromDictation: true,
    };
    flushSync(() => {
      setPendingAgentMessage(payload);
      setCurrentTab('agent');
    });
  };

  const sendDictationToChat = (plainText: string) => {
    const payload: NonNullable<PendingAgentMessage> = {
      text: plainText,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      fromDictation: true,
    };
    flushSync(() => {
      setPendingAgentMessage(payload);
      setCurrentTab('agent');
    });
  };

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] w-full bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white/50 animate-spin" aria-label="Načítání" />
      </div>
    );
  }

  if (!user) {
    return <AssistantLoginScreen accessDeniedMessage={accessDeniedMessage} />;
  }

  if (!isAssistantEmailAllowed(user.email)) {
    return <AssistantLoginScreen accessDeniedMessage={accessDeniedMessage ?? ACCESS_DENIED_MSG} />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <ResponsiveLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'dictation' ? (
        <DictationTab
          onSendToAssistant={sendDictationToAssistant}
          onSendToChat={sendDictationToChat}
          onAfterTodoAdded={() => setCurrentTab('tasks')}
        />
      ) : currentTab === 'agent' ? (
        <AgentTab
          key={pendingAgentMessage?.nonce ?? 'agent-default'}
          initialMessage={pendingAgentMessage?.text}
          initialMessageFromDictation={pendingAgentMessage?.fromDictation}
        />
      ) : currentTab === 'tasks' ? (
        <TasksTab />
      ) : currentTab === 'outreach' ? (
        <OutreachTab />
      ) : currentTab === 'scraping' ? (
        <ScrapingTab />
      ) : currentTab === 'map' ? (
        <MapTab />
      ) : (
        <SettingsTab />
      )}
    </ResponsiveLayout>
  );
};
