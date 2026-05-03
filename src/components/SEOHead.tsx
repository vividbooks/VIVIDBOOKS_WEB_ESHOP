import { Helmet } from 'react-helmet-async';
import { DEFAULT_OG_IMAGE, SITE_URL } from '../utils/ogImage';

const SITE_NAME = 'Vividbooks';
const DEFAULT_DESCRIPTION = 'Interaktivn\u00ed digit\u00e1ln\u00ed u\u010debnice pro \u010desk\u00e9 z\u00e1kladn\u00ed \u0161koly. Matematika, fyzika, chemie, p\u0159\u00edrodopis a dal\u0161\u00ed p\u0159edm\u011bty o\u017eivuj\u00ed d\u00edky animac\u00edm a interaktivn\u00edm prvk\u016fm.';

interface SEOHeadProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  /** Alt text pro og:image / Twitter (doporučeno pro přístupnost a konzistentní náhledy). */
  imageAlt?: string;
  /** Volitelně pro šablony 1200×630 (Meta doporučuje uvádět u statických OG). */
  imageWidth?: number;
  imageHeight?: number;
  /** Twitter @handle bez @, např. vividbooks — lze nastavit i VITE_TWITTER_SITE v .env */
  twitterSite?: string;
  type?: 'website' | 'article' | 'product';
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
  };
  jsonLd?: Record<string, any> | Record<string, any>[];
  noIndex?: boolean;
}

function envTwitterSite(): string | undefined {
  try {
    const v = import.meta.env?.VITE_TWITTER_SITE as string | undefined;
    return v?.replace(/^@/, '').trim() || undefined;
  } catch {
    return undefined;
  }
}

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  imageWidth,
  imageHeight,
  twitterSite: twitterSiteProp,
  type = 'website',
  article,
  jsonLd,
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} \u2013 Interaktivn\u00ed digit\u00e1ln\u00ed u\u010debnice`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const resolvedImageAlt =
    (imageAlt?.trim() || (title ? `Náhled: ${title} — ${SITE_NAME}` : `${SITE_NAME} — digitální učebnice pro ZŠ`)).slice(0, 420);
  const twitterSite = (twitterSiteProp?.replace(/^@/, '').trim() || envTwitterSite()) ?? '';

  // Organization JSON-LD (always present)
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Vividbooks',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: 'Interaktivn\u00ed digit\u00e1ln\u00ed u\u010debnice pro \u010desk\u00e9 z\u00e1kladn\u00ed \u0161koly.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+420-602-227-674',
      email: 'hello@vividbooks.com',
      contactType: 'customer service',
      availableLanguage: 'Czech',
    },
    sameAs: [
      'https://www.facebook.com/vividbooks',
      'https://www.instagram.com/vividbooks',
      'https://www.linkedin.com/company/vividbooks',
    ],
  };

  const allJsonLd = [
    organizationLd,
    ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []),
  ];

  return (
    <Helmet>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={resolvedImageAlt} />
      {typeof imageWidth === 'number' && imageWidth > 0 && (
        <meta property="og:image:width" content={String(Math.round(imageWidth))} />
      )}
      {typeof imageHeight === 'number' && imageHeight > 0 && (
        <meta property="og:image:height" content={String(Math.round(imageHeight))} />
      )}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="cs_CZ" />

      {/* Article-specific OG */}
      {article?.publishedTime && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={resolvedImageAlt} />
      {twitterSite ? <meta name="twitter:site" content={`@${twitterSite}`} /> : null}

      {/* JSON-LD */}
      {allJsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}

/* ── Helpers for JSON-LD schemas ──────────────────────────────── */

export function productJsonLd(product: {
  name: string;
  description?: string;
  image?: string;
  price?: number;
  category?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: product.image || '',
    category: product.category || 'Digit\u00e1ln\u00ed u\u010debnice',
    brand: { '@type': 'Organization', name: 'Vividbooks' },
    offers: {
      '@type': 'Offer',
      price: product.price || 0,
      priceCurrency: 'CZK',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Vividbooks' },
    },
  };
}

export function articleJsonLd(article: {
  title: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description || '',
    image: article.image || '',
    datePublished: article.datePublished || '',
    dateModified: article.dateModified || article.datePublished || '',
    author: { '@type': 'Organization', name: 'Vividbooks' },
    publisher: {
      '@type': 'Organization',
      name: 'Vividbooks',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
  };
}

export function webinarJsonLd(webinar: {
  name: string;
  description?: string;
  startDate: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: webinar.name,
    description: webinar.description || '',
    startDate: webinar.startDate,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url: webinar.url,
    },
    organizer: { '@type': 'Organization', name: 'Vividbooks' },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
