import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Settings } from 'lucide-react';
import { Toaster } from 'sonner@2.0.3';
import { useProducts } from '../contexts/ProductsContext';
import { CartProvider } from '../contexts/CartContext';
import { BlogProvider } from '../contexts/BlogContext';
import { WebinarsProvider } from '../contexts/WebinarsContext';
import { NovinkyProvider } from '../contexts/NovinkyContext';
import { OrderNavProvider } from '../contexts/OrderNavContext';
import { DvppVideosProvider } from '../contexts/DvppVideosContext';
import { CartDrawer } from './checkout/CartDrawer';
import { AdminPanel } from './AdminPanel';
import { WebflowDebugPanel } from './WebflowDebugPanel';
import { PopupRenderer } from './PopupRenderer';
import { CookieConsentBar } from './CookieConsentBar';
import { WebflowLegacyRedirect } from './WebflowLegacyRedirect';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RootInner() {
  const { fetchProducts } = useProducts();
  const navigate = useNavigate();
  const showAdminAccess = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('admin') === 'true';

  return (
    <>
      <ScrollToTop />
      <WebflowLegacyRedirect />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: { fontFamily: "'Fenomen Sans', sans-serif", borderRadius: '999px' },
        }}
      />
      <WebflowDebugPanel />
      {showAdminAccess && (
        <button
          onClick={() => navigate('/admin')}
          className="fixed bottom-4 right-4 z-[200] bg-[#04036b] text-white p-3 rounded-full shadow-lg hover:bg-[#03025a] transition-colors opacity-50 hover:opacity-100"
          title="Admin"
        >
          <Settings className="size-5" />
        </button>
      )}
      <CartDrawer />
      {/* Popup Manager renderer */}
      <PopupRenderer />
      <CookieConsentBar />
      <Outlet />
    </>
  );
}

export default function Root() {
  return (
    <CartProvider>
      <BlogProvider>
        <WebinarsProvider>
          <NovinkyProvider>
            <DvppVideosProvider>
              <OrderNavProvider>
                <RootInner />
              </OrderNavProvider>
            </DvppVideosProvider>
          </NovinkyProvider>
        </WebinarsProvider>
      </BlogProvider>
    </CartProvider>
  );
}