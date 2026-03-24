import React from 'react';
import { AppProvider } from '@/app/contexts/AppContext';
import { InnerApp } from '@/app/InnerApp';
import { SEOHead } from './SEOHead';

export default function VividAssistantShellPage() {
  return (
    <AppProvider>
      <SEOHead title="Asistent" path="/assistant" description="Vividbooks asistent." noIndex />
      <InnerApp />
    </AppProvider>
  );
}
