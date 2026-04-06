import type { ComponentType } from 'react';
import React from 'react';
import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { RouteHydrateFallback } from './components/RouteHydrateFallback';
import Root from './components/Root';

/** React Router 7: u každé `lazy` routy doplnit hydrateFallbackElement. */
function withLazyHydrateFallbacks(nodes: RouteObject[]): RouteObject[] {
  return nodes.map((node) => {
    const patched: RouteObject = { ...node };
    if (node.lazy != null && patched.hydrateFallbackElement == null) {
      patched.hydrateFallbackElement = React.createElement(RouteHydrateFallback);
    }
    if (node.children?.length) {
      patched.children = withLazyHydrateFallbacks(node.children as RouteObject[]);
    }
    return patched;
  });
}

/** Default export → RouteObject.lazy */
function lazyDefault(importer: () => Promise<{ default: ComponentType<unknown> }>) {
  return async () => {
    const m = await importer();
    return { Component: m.default };
  };
}

/** Pojmenovaný export → RouteObject.lazy */
function lazyNamed<T extends Record<string, ComponentType<unknown>>>(
  importer: () => Promise<T>,
  name: keyof T,
) {
  return async () => {
    const m = await importer();
    return { Component: m[name] };
  };
}

export const router = createBrowserRouter(
  withLazyHydrateFallbacks([
    {
      path: '/hub',
      lazy: lazyNamed(() => import('./components/AgentHubPage'), 'AgentHubPage'),
    },
    {
      path: '/assistant',
      lazy: lazyDefault(() => import('./components/VividAssistantShellPage')),
    },
    {
      path: '/asistent',
      lazy: lazyDefault(() => import('./components/VividAssistantShellPage')),
    },
    {
      path: '/',
      Component: Root,
      children: [
        {
          path: 'webinar/:id/live',
          lazy: lazyNamed(() => import('./components/WebinarLiveRoute'), 'WebinarLiveRoute'),
        },
        {
          lazy: lazyDefault(() => import('./components/CatalogLayout')),
          children: [
            { index: true, lazy: lazyDefault(() => import('./components/CatalogGrid')) },
            {
              path: 'predmet/:slug',
              lazy: lazyNamed(() => import('./components/SubjectPageRoute'), 'SubjectPageRoute'),
            },
            {
              path: 'produkt/:id',
              lazy: lazyNamed(() => import('./components/ProductDetailRoute'), 'ProductDetailRoute'),
            },
            { path: 'balicek/:bundleId', lazy: lazyNamed(() => import('./components/BundlePage'), 'BundlePage') },
            { path: 'objednat', lazy: lazyNamed(() => import('./components/OrderPage'), 'OrderPage') },
            {
              path: 'pokladna',
              lazy: lazyNamed(() => import('./components/checkout/CheckoutPage'), 'CheckoutPage'),
            },
            {
              path: 'objednavka/dekujeme',
              lazy: lazyNamed(() => import('./components/checkout/OrderConfirmationPage'), 'OrderConfirmationPage'),
            },
            { path: 'webinare', lazy: lazyNamed(() => import('./components/WebinarsPage'), 'WebinarsPage') },
            {
              path: 'webinare/zaznam/:id',
              lazy: lazyNamed(() => import('./components/DvppVideoDetailPage'), 'DvppVideoDetailPage'),
            },
            {
              path: 'webinar/:id/dotaznik',
              lazy: lazyNamed(() => import('./components/WebinarSurveyRedirectRoute'), 'WebinarSurveyRedirectRoute'),
            },
            {
              path: 'webinar/:id/dvpp-dotaznik',
              lazy: lazyNamed(() => import('./components/WebinarDvppDotaznikRedirectRoute'), 'WebinarDvppDotaznikRedirectRoute'),
            },
            {
              path: 'webinar/:id',
              lazy: lazyNamed(() => import('./components/WebinarDetailRoute'), 'WebinarDetailRoute'),
            },
            { path: 'blog', lazy: lazyNamed(() => import('./components/BlogPage'), 'BlogPage') },
            { path: 'blog/:slug', lazy: lazyNamed(() => import('./components/BlogDetailRoute'), 'BlogDetailRoute') },
            { path: 'novinky', lazy: lazyNamed(() => import('./components/NovinkyPage'), 'NovinkyPage') },
            {
              path: 'novinky/:slug',
              lazy: lazyNamed(() => import('./components/NovinkaDetailRoute'), 'NovinkaDetailRoute'),
            },
            { path: 'vyzkousejte', lazy: lazyNamed(() => import('./components/TrialPage'), 'TrialPage') },
            { path: 'vividboard', lazy: lazyNamed(() => import('./components/VividboardPage'), 'VividboardPage') },
            { path: 'kontakt', lazy: lazyNamed(() => import('./components/ContactPage'), 'ContactPage') },
            { path: '*', lazy: lazyNamed(() => import('./components/NotFound'), 'NotFound') },
          ],
        },
      ],
    },
    {
      path: '/admin',
      lazy: lazyDefault(() => import('./components/admin/AdminLayout')),
      children: [
        { index: true, lazy: lazyDefault(() => import('./components/admin/AdminDashboard')) },
        { path: 'blog', lazy: lazyDefault(() => import('./components/admin/BlogEditor')) },
        { path: 'novinky', lazy: lazyDefault(() => import('./components/admin/NovinkyEditor')) },
        {
          path: 'kolekce/:collection',
          lazy: lazyDefault(() => import('./components/admin/CollectionBrowser')),
        },
        { path: 'stranky', lazy: lazyDefault(() => import('./components/admin/FixedPagesManager')) },
        { path: 'migrace', lazy: lazyDefault(() => import('./components/admin/MigrationPage')) },
        {
          path: 'objednavky',
          lazy: lazyNamed(() => import('./components/admin/AdminOrdersPage'), 'AdminOrdersPage'),
        },
        {
          path: 'objednavky/:id',
          lazy: lazyNamed(() => import('./components/admin/AdminOrderDetailPage'), 'AdminOrderDetailPage'),
        },
        {
          path: 'analytika',
          lazy: lazyNamed(() => import('./components/admin/AdminAnalyticsPage'), 'AdminAnalyticsPage'),
        },
        { path: 'skoly', lazy: lazyDefault(() => import('./components/admin/AdminSchoolsPage')) },
        { path: 'sklad', lazy: lazyDefault(() => import('./components/admin/AdminStockPage')) },
        {
          path: 'alerty',
          lazy: lazyNamed(() => import('./components/admin/AdminOrderAlertsPage'), 'AdminOrderAlertsPage'),
        },
        { path: 'balicky', lazy: lazyDefault(() => import('./components/admin/ProductBundlesPage')) },
        { path: 'agent', lazy: lazyNamed(() => import('./components/admin/AdminAgentPage'), 'AdminAgentPage') },
        {
          path: 'visual-editor',
          lazy: lazyDefault(() => import('./components/admin/VisualEditorPage')),
        },
      ],
    },
    {
      path: '/marketing',
      lazy: lazyDefault(() => import('./components/admin/AdminLayout')),
      children: [
        {
          index: true,
          lazy: lazyDefault(() => import('./components/admin/MarketingDashboard')),
        },
        { path: 'webinare', lazy: lazyDefault(() => import('./components/admin/AdminWebinarPanel')) },
        { path: 'emaily', lazy: lazyDefault(() => import('./components/admin/EmailBuilder')) },
        { path: 'kalendar', lazy: lazyDefault(() => import('./components/admin/MarketingCalendar')) },
        { path: 'galerie', lazy: lazyDefault(() => import('./components/admin/ImageGallery')) },
        { path: 'popupy', lazy: lazyDefault(() => import('./components/admin/PopupManager')) },
        {
          path: 'registrace',
          lazy: lazyDefault(() => import('./components/admin/WebinarRegistraceAdmin')),
        },
        {
          path: 'kontakty',
          lazy: lazyDefault(() => import('./components/admin/MarketingContactsPage')),
        },
        { path: 'skoly', lazy: lazyDefault(() => import('./components/admin/SchoolsUploadPage')) },
        {
          path: 'growth-agent',
          lazy: lazyDefault(() => import('./components/admin/GrowthAgentPage')),
        },
        {
          path: 'marketing-agent',
          lazy: lazyDefault(() => import('./components/admin/MarketingAgent')),
        },
        { path: 'seo-agent', lazy: lazyDefault(() => import('./components/admin/SeoAgent')) },
        {
          path: 'image-agent/referencni-styly',
          lazy: lazyDefault(() => import('./components/admin/ReferenceStylesSettingsPage')),
        },
        { path: 'image-agent', lazy: lazyDefault(() => import('./components/admin/ImageAgentPage')) },
        { path: 'rag', lazy: lazyDefault(() => import('./components/admin/RagPage')) },
      ],
    },
  ]),
  { basename: import.meta.env.BASE_URL },
);
