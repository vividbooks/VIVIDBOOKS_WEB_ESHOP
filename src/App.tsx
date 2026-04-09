import React, { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider } from '@/app/contexts/AppContext';
import { ProductsProvider } from './contexts/ProductsContext';
import { WebOperatorChatsBridgeProvider } from './contexts/WebOperatorChatsBridgeContext';
import { scheduleChunkReloadFlagClear } from './utils/installChunkLoadRecovery';

function RouteLoadingFallback() {
  return (
    <div
      className="min-h-[40vh] flex items-center justify-center"
      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-[#7C3AED]/25 border-t-[#7C3AED] animate-spin" />
        <p className="text-[14px] text-[#001161]/55">Načítám stránku…</p>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    scheduleChunkReloadFlagClear();
  }, []);
  return (
    <AppProvider>
      <ProductsProvider>
        <WebOperatorChatsBridgeProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
            <RouterProvider router={router} />
          </Suspense>
        </WebOperatorChatsBridgeProvider>
      </ProductsProvider>
    </AppProvider>
  );
}
