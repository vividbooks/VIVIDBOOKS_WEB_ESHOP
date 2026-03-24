import { createBrowserRouter } from 'react-router';
import Root from './components/Root';
import CatalogLayout from './components/CatalogLayout';
import CatalogGrid from './components/CatalogGrid';
import { SubjectPageRoute } from './components/SubjectPageRoute';
import { ProductDetailRoute } from './components/ProductDetailRoute';
import { OrderPage } from './components/OrderPage';
import { NotFound } from './components/NotFound';
import { WebinarsPage } from './components/WebinarsPage';
import { WebinarDetailRoute } from './components/WebinarDetailRoute';
import { WebinarLiveRoute } from './components/WebinarLiveRoute';
import { BlogPage } from './components/BlogPage';
import { BlogDetailRoute } from './components/BlogDetailRoute';
import { NovinkyPage } from './components/NovinkyPage';
import { NovinkaDetailRoute } from './components/NovinkaDetailRoute';
import { TrialPage } from './components/TrialPage';
import { ContactPage } from './components/ContactPage';
import { DvppVideoDetailPage } from './components/DvppVideoDetailPage';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { BundlePage } from './components/BundlePage';
import { OrderConfirmationPage } from './components/checkout/OrderConfirmationPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import MarketingDashboard from './components/admin/MarketingDashboard';
import CollectionBrowser from './components/admin/CollectionBrowser';
import FixedPagesManager from './components/admin/FixedPagesManager';
import MigrationPage from './components/admin/MigrationPage';
import AdminStockPage from './components/admin/AdminStockPage';
import { AdminAnalyticsPage } from './components/admin/AdminAnalyticsPage';
import { AdminSchoolsPage } from './components/admin/AdminSchoolsPage';
import { AdminOrdersPage } from './components/admin/AdminOrdersPage';
import { AdminOrderDetailPage } from './components/admin/AdminOrderDetailPage';
import { AdminOrderAlertsPage } from './components/admin/AdminOrderAlertsPage';
import ProductBundlesPage from './components/admin/ProductBundlesPage';
import BlogEditor from './components/admin/BlogEditor';
import NovinkyEditor from './components/admin/NovinkyEditor';
import WebinareEditor from './components/admin/WebinareEditor';
import RagPage from './components/admin/RagPage';
import PopupManager from './components/admin/PopupManager';
import WebinarRegistraceAdmin from './components/admin/WebinarRegistraceAdmin';
import AdminWebinarPanel from './components/admin/AdminWebinarPanel';
import SchoolsUploadPage from './components/admin/SchoolsUploadPage';
import MarketingAgent from './components/admin/MarketingAgent';
import EmailBuilder from './components/admin/EmailBuilder';
import ImageGallery from './components/admin/ImageGallery';
import MarketingCalendar from './components/admin/MarketingCalendar';
import { AdminAgentPage } from './components/admin/AdminAgentPage';
import { AgentHubPage } from './components/AgentHubPage';
import SeoAgent from './components/admin/SeoAgent';
import ImageAgentPage from './components/admin/ImageAgentPage';
import ReferenceStylesSettingsPage from './components/admin/ReferenceStylesSettingsPage';
import VisualEditorPage from './components/admin/VisualEditorPage';
import GrowthAgentPage from './components/admin/GrowthAgentPage';
import VividAssistantShellPage from './components/VividAssistantShellPage';

export const router = createBrowserRouter(
  [
  /* ── Agent Hub — standalone mobilní stránka ───────────────────────── */
  {
    path: '/hub',
    Component: AgentHubPage,
  },
  {
    path: '/assistant',
    Component: VividAssistantShellPage,
  },
  {
    path: '/',
    Component: Root,
    children: [
      // Live webinar — standalone, bez CatalogLayout (žádný sidebar)
      { path: 'webinar/:id/live', Component: WebinarLiveRoute },
      {
        Component: CatalogLayout,
        children: [
          { index: true,                    Component: CatalogGrid           },
          { path: 'predmet/:slug',          Component: SubjectPageRoute      },
          { path: 'produkt/:id',            Component: ProductDetailRoute    },
          { path: 'balicek/:bundleId',      Component: BundlePage            },
          { path: 'objednat',               Component: OrderPage             },
          { path: 'pokladna',               Component: CheckoutPage          },
          { path: 'objednavka/dekujeme',    Component: OrderConfirmationPage },
          { path: 'webinare',               Component: WebinarsPage          },
          { path: 'webinare/zaznam/:id',    Component: DvppVideoDetailPage   },
          { path: 'webinar/:id',            Component: WebinarDetailRoute    },
          { path: 'blog',                   Component: BlogPage              },
          { path: 'blog/:slug',             Component: BlogDetailRoute       },
          { path: 'novinky',               Component: NovinkyPage           },
          { path: 'novinky/:slug',          Component: NovinkaDetailRoute    },
          { path: 'vyzkousejte',            Component: TrialPage             },
          { path: 'kontakt',               Component: ContactPage           },
          { path: '*',                      Component: NotFound              },
        ],
      },
    ],
  },
  /* ── Web Admin ──────────────────────────────────────────────────────── */
  {
    path: '/admin',
    Component: AdminLayout,
    children: [
      { index: true,                    Component: AdminDashboard    },
      { path: 'blog',                   Component: BlogEditor        },
      { path: 'novinky',               Component: NovinkyEditor     },
      { path: 'kolekce/:collection',    Component: CollectionBrowser },
      { path: 'stranky',               Component: FixedPagesManager },
      { path: 'migrace',               Component: MigrationPage     },
      { path: 'objednavky',            Component: AdminOrdersPage   },
      { path: 'objednavky/:id',        Component: AdminOrderDetailPage },
      { path: 'analytika',             Component: AdminAnalyticsPage },
      { path: 'skoly',                 Component: AdminSchoolsPage  },
      { path: 'sklad',                 Component: AdminStockPage    },
      { path: 'alerty',                Component: AdminOrderAlertsPage },
      { path: 'balicky',               Component: ProductBundlesPage  },
      { path: 'agent',                  Component: AdminAgentPage    },
      { path: 'visual-editor',          Component: VisualEditorPage  },
    ],
  },
  /* ── Marketing Admin ────────────────────────────────────────────────── */
  {
    path: '/marketing',
    Component: AdminLayout,
    children: [
      { index: true,                    Component: MarketingDashboard        },
      { path: 'webinare',              Component: AdminWebinarPanel         },
      { path: 'emaily',                Component: EmailBuilder              },
      { path: 'kalendar',             Component: MarketingCalendar         },
      { path: 'galerie',               Component: ImageGallery              },
      { path: 'popupy',                Component: PopupManager              },
      { path: 'registrace',            Component: WebinarRegistraceAdmin    },
      { path: 'skoly',                 Component: SchoolsUploadPage         },
      { path: 'growth-agent',         Component: GrowthAgentPage           },
      { path: 'marketing-agent',       Component: MarketingAgent            },
      { path: 'seo-agent',             Component: SeoAgent                  },
      { path: 'image-agent/referencni-styly', Component: ReferenceStylesSettingsPage },
      { path: 'image-agent',           Component: ImageAgentPage            },
      { path: 'rag',                   Component: RagPage                   },
    ],
  },
],
  { basename: import.meta.env.BASE_URL },
);