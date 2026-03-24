# Growth Agent

## Cíl
`Growth Agent` je nový modul v marketing adminu na adrese `/marketing/growth-agent`.

Jeho role:
- generovat reklamní kreativy pro `Meta Ads` i `Google Ads`
- držet review workflow před publikací
- nahrávat schválené kreativy na platformy
- průběžně sbírat výkon a z něj navrhovat další iterace

Mimo scope:
- vlastní targeting engine
- autonomní změny budgetu bez schválení
- složitý bidding optimizer
- multi-touch attribution

## Zasazení do současného adminu
Existující marketing admin už má dva vhodné vzory:

1. Agent workspace v `src/components/admin/SeoAgent.tsx` a `src/components/admin/MarketingAgent.tsx`
2. Visual composer v `src/components/admin/VisualEditorPage.tsx`

Growth Agent bude kombinovat obojí:
- primární UX bude `agent-first workspace`
- creative preview a asset picking převezmou principy z visual editoru
- persistence reklam zůstane oddělená od `hero-slidy`

## Frontend architektura

### Route a layout
- přidat route do `src/routes.ts` pod `/marketing`
- přidat sidebar položku do `src/components/admin/AdminLayout.tsx`
- rozšířit `isAgentWorkspace`, aby měl Growth Agent stejný horizontální shell jako ostatní agenti

### Hlavní stránka
Nový soubor: `src/components/admin/GrowthAgentPage.tsx`

Rozložení:
- levý panel: chaty, filtry, rychlé akce
- střed: agent chat a brief composer
- pravý panel: creatives preview, asset picker, review queue

Interní panely:
- `Agent`
- `Creatives`
- `Campaigns`
- `Insights`

Nejde o klasický dashboard jako výchozí pohled. Dashboard metrik může být podpanel, ale hlavní workflow je brief -> generování -> review -> publish.

## Reuse z existujících komponent

### Reuse z `SeoAgent` / `MarketingAgent`
- chat shell
- historie chatů
- auto-save konverzací
- model picker
- request pattern na Supabase function
- případně `ContentCanvas` pro delší výstupy nebo strukturovaný náhled

### Reuse z `VisualEditorPage`
- agregovaný asset picker přes produkty, blog, novinky, webináře a uploads
- preview-first workflow
- produktový kontext přes `useProducts`
- brand-consistent render logika tam, kde dává smysl

### Nepřebírat
- `EditorDoc` z hero slideru
- `hero-slidy` payload mapping
- hero-specific layout enumy jako datový model reklam

## Datový model

### `growth_creatives`
```ts
type GrowthCreative = {
  id: string;
  productId: string | null;
  angle: string;
  audienceHint: 'teacher' | 'parent' | 'school' | 'mixed';
  platformTargets: Array<'meta' | 'google'>;
  format: 'image_single' | 'carousel' | 'story' | 'pmax_asset';
  headline: string;
  primaryText: string;
  cta: string;
  visualPrompt: string;
  imageUrl?: string;
  reviewStatus: 'draft' | 'approved' | 'rejected';
  publishStatus: 'new' | 'queued' | 'active' | 'paused' | 'failed';
  performance?: {
    ctr?: number;
    cpc?: number;
    roas?: number;
    conversions?: number;
  };
  metaRef?: {
    campaignId?: string;
    adSetId?: string;
    creativeId?: string;
    adId?: string;
  };
  googleRef?: {
    campaignId?: string;
    assetGroupId?: string;
    assetId?: string;
    adId?: string;
  };
  createdAt: string;
  updatedAt: string;
};
```

### `growth_campaigns`
```ts
type GrowthCampaign = {
  id: string;
  platform: 'meta' | 'google';
  name: string;
  status: 'draft' | 'active' | 'paused' | 'failed';
  budget: number;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
};
```

### `growth_insights`
```ts
type GrowthInsight = {
  id: string;
  type: 'pattern' | 'recommendation';
  content: string;
  confidence: number;
  relatedCreativeIds?: string[];
  createdAt: string;
};
```

### `growth_chat_sessions`
Stejný princip jako `marketing-chats` a `seo-chats`, ale oddělený namespace.

## Backend architektura
Growth Agent poběží ve stejné Supabase function `src/supabase/functions/server/index.tsx`, aby reuse odpovídal současnému adminu.

První vrstva:
- chat endpoint
- CRUD pro chat history
- generování kreativ
- CRUD pro creatives

Další vrstva:
- upload do Meta
- upload do Google
- performance fetch
- insights
- optimizer

## API návrh

### Chat a historie
- `POST /make-server-93a20b6f/admin/growth-agent`
- `GET /make-server-93a20b6f/admin/growth-agent-chats`
- `GET /make-server-93a20b6f/admin/growth-agent-chats/:id`
- `POST /make-server-93a20b6f/admin/growth-agent-chats`
- `DELETE /make-server-93a20b6f/admin/growth-agent-chats/:id`

### Creatives
- `GET /make-server-93a20b6f/admin/growth-creatives`
- `GET /make-server-93a20b6f/admin/growth-creatives/:id`
- `POST /make-server-93a20b6f/admin/growth-creatives`
- `PUT /make-server-93a20b6f/admin/growth-creatives/:id`
- `DELETE /make-server-93a20b6f/admin/growth-creatives/:id`
- `POST /make-server-93a20b6f/admin/growth-creatives/generate`

### Campaigns a insights
- `GET /make-server-93a20b6f/admin/growth-campaigns`
- `POST /make-server-93a20b6f/admin/growth-campaigns`
- `GET /make-server-93a20b6f/admin/growth-insights`
- `POST /make-server-93a20b6f/admin/growth-insights/generate`

### Publishing a performance
- `POST /make-server-93a20b6f/admin/growth-creatives/:id/approve`
- `POST /make-server-93a20b6f/admin/growth-creatives/:id/reject`
- `POST /make-server-93a20b6f/admin/growth-upload/meta`
- `POST /make-server-93a20b6f/admin/growth-upload/google`
- `GET /make-server-93a20b6f/admin/growth-performance`
- `POST /make-server-93a20b6f/admin/growth-optimize`

## Meta a Google
Meta i Google musí být od začátku první třída, ne až dodatečný doplněk.

Pravidla návrhu:
- creative záznam musí umět nést reference pro obě platformy
- uploader musí mít oddělené adaptéry `MetaPublisher` a `GooglePublisher`
- Google nesmí být jen sekundární checkbox vedle Met y
- publikační stav musí být čitelný po platformách

## Guardrails
- kampaně se nesmí automaticky mazat
- změna budgetu vyžaduje explicitní approval
- AI creative nesmí jít live bez review stavu `approved`
- targeting a bidding zůstávají mimo scope

## Fázování

### Phase 0
- dokumentace
- route
- sidebar
- shell page
- potvrzení API shape

### Phase 1
- `growth_creatives` persistence
- generování kreativ
- creative list
- preview
- review flow

### Phase 2
- upload do `Meta Ads`
- upload do `Google Ads`
- základní kampaně panel
- základní dashboard metrik

### Phase 3
- performance ingest
- insights engine
- optimizer loop
- doporučené iterace

## MVP pro první implementaci
První implementace má dodat fungující smyčku:

1. uživatel zadá brief nebo použije chat
2. backend vygeneruje více creative draftů
3. drafty se uloží
4. v UI se dají prohlížet a ručně schválit
5. zatím bez ostrého publish flow do Meta/Google

Tím vznikne první reálně použitelná creative factory, na kterou půjde bezpečně navázat publishery a performance loop.
