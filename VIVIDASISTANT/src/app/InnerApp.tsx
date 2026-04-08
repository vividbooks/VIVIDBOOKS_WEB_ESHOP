import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { SchoolTourTab } from '@/app/components/tabs/SchoolTourTab';
import { AssistantLoginScreen } from '@/app/components/AssistantLoginScreen';
import { Onboarding } from '@/app/components/Onboarding';
import { isAssistantEmailAllowed, isAssistantExtendedUi, isAssistantRagWebDictation } from '@/config/assistantAllowlist';

const WebOperatorPage = lazy(() =>
  import('@/components/admin/AdminAgentPage').then((m) => ({ default: m.AdminAgentPage })),
);

type PendingAgentMessage = { text: string; nonce: string; fromDictation?: boolean } | null;
type PendingWebOperatorMessage = { text: string; nonce: string } | null;

const ACCESS_DENIED_MSG = 'Tento účet nemá přístup k asistentovi.';

export const InnerApp: React.FC = () => {
  const { user, authReady, signOut } = useApp();
  const [currentTab, setCurrentTab] = useState<AssistantTabId>('dictation');
  const [pendingAgentMessage, setPendingAgentMessage] = useState<PendingAgentMessage>(null);
  const [pendingWebOperatorMessage, setPendingWebOperatorMessage] = useState<PendingWebOperatorMessage>(null);
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

  const extendedUi = user?.email ? isAssistantExtendedUi(user.email) : false;
  const ragWeb = user?.email ? isAssistantRagWebDictation(user.email) : false;

  useEffect(() => {
    if (extendedUi) return;
    if (currentTab === 'outreach' || currentTab === 'scraping') {
      setCurrentTab('dictation');
    }
  }, [extendedUi, currentTab]);

  useEffect(() => {
    if (ragWeb) return;
    if (currentTab === 'webOperator') setCurrentTab('dictation');
  }, [ragWeb, currentTab]);

  const prevTabRef = useRef<AssistantTabId>(currentTab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = currentTab;
    if (prev === 'webOperator' && currentTab !== 'webOperator') {
      setPendingWebOperatorMessage(null);
    }
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

  const sendDictationToWebOperator = useCallback((plainText: string) => {
    const t = plainText.trim();
    if (!t) return;
    flushSync(() => {
      setPendingWebOperatorMessage({
        text: t,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      setCurrentTab('webOperator');
    });
    toast.success('Otevírám Web operátora se zadáním…');
  }, []);

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
    <ResponsiveLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      extendedUi={extendedUi}
      webOperatorNav={ragWeb}
    >
      {currentTab === 'dictation' ? (
        <DictationTab
          onSendToAssistant={sendDictationToAssistant}
          onSendToChat={sendDictationToChat}
          onSendToWebOperator={ragWeb ? sendDictationToWebOperator : undefined}
          onAfterTodoAdded={() => setCurrentTab('tasks')}
        />
      ) : currentTab === 'agent' ? (
        <AgentTab
          initialMessage={pendingAgentMessage?.text}
          initialMessageFromDictation={pendingAgentMessage?.fromDictation}
          initialMessageNonce={pendingAgentMessage?.nonce ?? null}
        />
      ) : currentTab === 'webOperator' ? (
        <Suspense
          fallback={
            <div className="flex h-full min-h-[50dvh] w-full items-center justify-center bg-[#f7f8fc]">
              <Loader2 className="h-10 w-10 animate-spin text-[#7C3AED]/50" aria-label="Načítání Web operátora" />
            </div>
          }
        >
          <WebOperatorPage
            hubMode
            queuedFromDictation={pendingWebOperatorMessage}
            onQueuedFromDictationConsumed={() => setPendingWebOperatorMessage(null)}
          />
        </Suspense>
      ) : currentTab === 'tasks' ? (
        <TasksTab />
      ) : currentTab === 'outreach' ? (
        <OutreachTab />
      ) : currentTab === 'scraping' ? (
        <ScrapingTab />
      ) : currentTab === 'map' ? (
        <MapTab />
      ) : currentTab === 'schoolTour' ? (
        <SchoolTourTab />
      ) : (
        <SettingsTab />
      )}
    </ResponsiveLayout>
  );
};
