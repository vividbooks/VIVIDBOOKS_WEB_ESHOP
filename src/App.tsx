import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ProductsProvider } from './contexts/ProductsContext';
import { WebOperatorChatsBridgeProvider } from './contexts/WebOperatorChatsBridgeContext';

export default function App() {
  return (
    <ProductsProvider>
      <WebOperatorChatsBridgeProvider>
        <RouterProvider router={router} />
      </WebOperatorChatsBridgeProvider>
    </ProductsProvider>
  );
}
