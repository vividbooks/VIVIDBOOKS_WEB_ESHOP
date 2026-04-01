import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '@/app/contexts/AppContext';
import { ResponsiveLayout } from '@/app/components/Layout';
import { DictationTab } from '@/app/components/tabs/DictationTab';

type PendingAgentMessage = { text: string; nonce: string; fromDictation?: boolean } | null;
import { TasksTab } from '@/app/components/tabs/TasksTab';
import { AgentTab } from '@/app/components/tabs/AgentTab';
import { OutreachTab } from '@/app/components/tabs/OutreachTab';
import { ScrapingTab } from '@/app/components/tabs/ScrapingTab';
import { SettingsTab } from '@/app/components/tabs/SettingsTab';
import { MapTab } from '@/app/components/tabs/MapTab';
import { Onboarding } from '@/app/components/Onboarding';

export const InnerApp: React.FC = () => {
  const { settings } = useApp();
  const [currentTab, setCurrentTab] = useState<'dictation' | 'tasks' | 'agent' | 'outreach' | 'scraping' | 'map' | 'settings'>('dictation');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingAgentMessage, setPendingAgentMessage] = useState<PendingAgentMessage>(null);

  // Capture Google provider_token from OAuth callback
  useEffect(() => {
    const captureToken = async () => {
      // Method 1: From URL hash (implicit flow)
      const hash = window.location.hash;
      if (hash && hash.includes('provider_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const providerToken = params.get('provider_token');
        const providerRefreshToken = params.get('provider_refresh_token');
        
        if (providerToken) {
          localStorage.setItem('google_provider_token', providerToken);
          console.log('✅ Google provider_token saved from hash');
        }
        if (providerRefreshToken) {
          localStorage.setItem('google_provider_refresh_token', providerRefreshToken);
        }
        
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // Method 2: From Supabase session (PKCE flow)
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { projectId, publicAnonKey } = await import('/utils/supabase/info');
        const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.provider_token) {
          localStorage.setItem('google_provider_token', session.provider_token);
          console.log('✅ Google provider_token saved from session');
        }
        if (session?.provider_refresh_token) {
          localStorage.setItem('google_provider_refresh_token', session.provider_refresh_token);
        }
      } catch (e) {
        console.log('Session check skipped:', e);
      }
    };

    captureToken();
  }, []);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('dictation_app_onboarded');
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }

    // Add Apple PWA meta tags
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
    linkIcon.href = 'icon.png';
    document.head.appendChild(linkIcon);

    return () => {
      if (document.head.contains(metaCapable)) document.head.removeChild(metaCapable);
      if (document.head.contains(metaStatus)) document.head.removeChild(metaStatus);
      if (document.head.contains(linkIcon)) document.head.removeChild(linkIcon);
    };
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('dictation_app_onboarded', 'true');
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (currentTab !== 'agent') setPendingAgentMessage(null);
  }, [currentTab]);

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

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <ResponsiveLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
    >
      {currentTab === 'dictation' ? (
        <DictationTab onSendToAssistant={sendDictationToAssistant} onSendToChat={sendDictationToChat} />
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
