import React from 'react';
import VividAssistantPage from '@/components/VividAssistantPage';

interface WebOperatorTabProps {
  initialMessage?: string;
}

export const WebOperatorTab: React.FC<WebOperatorTabProps> = ({ initialMessage }) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <VividAssistantPage embedded initialMessage={initialMessage} />
    </div>
  );
};
