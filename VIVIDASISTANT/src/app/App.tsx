import React from 'react';
import { AppProvider } from '@/app/contexts/AppContext';
import { InnerApp } from '@/app/InnerApp';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="min-h-screen dark bg-background text-foreground relative isolate">
        {/* Subtle background ambient gradients */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-900/10 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-900/10 rounded-full blur-[120px]" />
        </div>
        
        <InnerApp />
      </div>
      <Toaster position="top-center" theme="dark" />
    </AppProvider>
  );
};

export default App;
