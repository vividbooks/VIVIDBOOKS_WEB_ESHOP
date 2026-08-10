import React, { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider } from '@/app/contexts/AppContext';
import { ProductsProvider } from './contexts/ProductsContext';
import { WebOperatorChatsBridgeProvider } from './contexts/WebOperatorChatsBridgeContext';
import { RouteHydrateFallback } from './components/RouteHydrateFallback';
import { scheduleChunkReloadFlagClear } from './utils/installChunkLoadRecovery';

export default function App() {
  useEffect(() => {
    scheduleChunkReloadFlagClear();
  }, []);
  return (
    <AppProvider>
      <ProductsProvider>
        <WebOperatorChatsBridgeProvider>
          <Suspense fallback={<RouteHydrateFallback />}>
            <RouterProvider router={router} />
          </Suspense>
        </WebOperatorChatsBridgeProvider>
      </ProductsProvider>
    </AppProvider>
  );
}
