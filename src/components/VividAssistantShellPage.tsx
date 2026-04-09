import React from 'react';
import { useLocation } from 'react-router';
import { InnerApp } from '@/app/InnerApp';
import { SEOHead } from './SEOHead';

export default function VividAssistantShellPage() {
  const { pathname } = useLocation();
  return (
    <>
      <SEOHead title="Asistent" path={pathname} description="Vividbooks asistent." noIndex />
      <InnerApp />
    </>
  );
}
