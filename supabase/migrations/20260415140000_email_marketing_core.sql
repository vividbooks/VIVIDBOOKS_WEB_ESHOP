-- Email marketing core: nahrazení Mailchimp datovým modelem + příprava na Resend.
-- Import: scripts/mailchimp-export.ts (service role). Čtení: authenticated (admin UI).

-- ── ENUMs ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.subscriber_contact_type AS ENUM (
    'teacher', 'school_admin', 'parent', 'homeschool', 'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscriber_source AS ENUM (
    'newsletter', 'trial', 'webinar', 'checkout', 'mailchimp_import', 'manual', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscriber_status AS ENUM (
    'subscribed', 'unsubscribed', 'cleaned', 'pending'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.email_event_type AS ENUM (
    'send', 'open', 'click', 'bounce', 'complaint', 'unsubscribe', 'resubscribe'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.email_event_source AS ENUM (
    'mailchimp', 'resend'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscriber_tag_source AS ENUM (
    'mailchimp', 'manual', 'system'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_enrollment_status AS ENUM (
    'active', 'paused', 'completed', 'exited'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── lists (Mailchimp audience) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailchimp_list_id TEXT NOT NULL,
  name TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lists_mailchimp_list_id_key UNIQUE (mailchimp_list_id)
);

CREATE INDEX IF NOT EXISTS idx_lists_name_lower ON public.lists (lower(name));

COMMENT ON TABLE public.lists IS 'Mailchimp list / audience; historie i budoucí segmenty.';

-- ── subscribers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL
    CHECK (char_length(email) > 0 AND email = lower(trim(email))),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  contact_type public.subscriber_contact_type NOT NULL DEFAULT 'unknown',
  source public.subscriber_source NOT NULL DEFAULT 'other',
  school_name TEXT,
  ico TEXT,
  status public.subscriber_status NOT NULL DEFAULT 'subscribed',
  trial_status TEXT,
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  is_customer BOOLEAN NOT NULL DEFAULT false,
  first_purchase_at TIMESTAMPTZ,
  total_orders INTEGER NOT NULL DEFAULT 0,
  engagement_score SMALLINT NOT NULL DEFAULT 0
    CHECK (engagement_score >= 0 AND engagement_score <= 100),
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  mc_member_id TEXT,
  mc_list_id TEXT,
  merge_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT subscribers_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers (email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON public.subscribers (status);
CREATE INDEX IF NOT EXISTS idx_subscribers_contact_type ON public.subscribers (contact_type);
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON public.subscribers (source);
CREATE INDEX IF NOT EXISTS idx_subscribers_mc_member ON public.subscribers (mc_member_id)
  WHERE mc_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_engagement ON public.subscribers (engagement_score);
CREATE INDEX IF NOT EXISTS idx_subscribers_last_open ON public.subscribers (last_opened_at DESC NULLS LAST);

COMMENT ON TABLE public.subscribers IS 'Hlavní kontakty; email musí být lower(trim); unikátní klíč email. Mailchimp merge fields v merge_fields + mapované sloupce.';
COMMENT ON COLUMN public.subscribers.mc_member_id IS 'Mailchimp member hash (id z API / MD5 e-mailu).';
COMMENT ON COLUMN public.subscribers.mc_list_id IS 'Primární Mailchimp list id při importu (reference).';

-- ── tags + M:N ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  mailchimp_tag_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON public.tags (lower(name));

CREATE TABLE IF NOT EXISTS public.subscriber_tags (
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  source public.subscriber_tag_source NOT NULL DEFAULT 'mailchimp',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_tags_tag ON public.subscriber_tags (tag_id);

-- ── členství v listech ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriber_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  mailchimp_unique_email_id TEXT,
  status public.subscriber_status NOT NULL DEFAULT 'subscribed',
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriber_lists_subscriber_list_key UNIQUE (subscriber_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_lists_list ON public.subscriber_lists (list_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_lists_status ON public.subscriber_lists (status);

-- ── campaigns ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES public.lists(id) ON DELETE SET NULL,
  mailchimp_campaign_id TEXT,
  resend_broadcast_id TEXT,
  name TEXT,
  subject_line TEXT,
  preview_text TEXT,
  status TEXT,
  campaign_type TEXT,
  send_time TIMESTAMPTZ,
  archive_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PostgREST upsert vyžaduje unikát bez filtru; více řádků s NULL u id je v PG povoleno.
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_mailchimp_id ON public.campaigns (mailchimp_campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_resend_id ON public.campaigns (resend_broadcast_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_send_time ON public.campaigns (send_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_campaigns_list ON public.campaigns (list_id);

-- ── tracked links ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  link_label TEXT,
  mailchimp_link_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_links_campaign_url_md5
  ON public.email_links (campaign_id, md5(url));

CREATE INDEX IF NOT EXISTS idx_email_links_campaign ON public.email_links (campaign_id);

-- ── events (opens, clicks, …) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.email_event_type NOT NULL,
  source public.email_event_source NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  link_id UUID REFERENCES public.email_links(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  provider_event_id TEXT,
  dedupe_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_events_dedupe_key UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_email_events_subscriber_time
  ON public.email_events (subscriber_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_time
  ON public.email_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type_time
  ON public.email_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_source ON public.email_events (source);
CREATE INDEX IF NOT EXISTS idx_email_events_provider
  ON public.email_events (source, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ── automation (budoucí scénáře) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  definition JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_flows_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  status public.automation_enrollment_status NOT NULL DEFAULT 'active',
  current_step_key TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_enrollments_flow_subscriber_key UNIQUE (flow_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_enrollments_subscriber ON public.automation_enrollments (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_automation_enrollments_flow_status ON public.automation_enrollments (flow_id, status);

-- ── updated_at triggers (funkce z dřívějších migrací) ────────────────────────

DROP TRIGGER IF EXISTS tr_lists_set_updated_at ON public.lists;
CREATE TRIGGER tr_lists_set_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_subscribers_set_updated_at ON public.subscribers;
CREATE TRIGGER tr_subscribers_set_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_subscriber_lists_set_updated_at ON public.subscriber_lists;
CREATE TRIGGER tr_subscriber_lists_set_updated_at
  BEFORE UPDATE ON public.subscriber_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER tr_campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_automation_flows_set_updated_at ON public.automation_flows;
CREATE TRIGGER tr_automation_flows_set_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_automation_enrollments_set_updated_at ON public.automation_enrollments;
CREATE TRIGGER tr_automation_enrollments_set_updated_at
  BEFORE UPDATE ON public.automation_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ── RLS: authenticated čte; zápis přes service role (obchází RLS) ───────────

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_enrollments ENABLE ROW LEVEL SECURITY;

-- Odstranění starých politik při re-run (lokální iterace)
DO $pol$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'lists', 'subscribers', 'tags', 'subscriber_tags', 'subscriber_lists',
    'campaigns', 'email_links', 'email_events', 'automation_flows', 'automation_enrollments'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_authenticated ON public.%I', t, t);
  END LOOP;
END
$pol$;

CREATE POLICY lists_select_authenticated ON public.lists FOR SELECT TO authenticated USING (true);
CREATE POLICY subscribers_select_authenticated ON public.subscribers FOR SELECT TO authenticated USING (true);
CREATE POLICY tags_select_authenticated ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY subscriber_tags_select_authenticated ON public.subscriber_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY subscriber_lists_select_authenticated ON public.subscriber_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY campaigns_select_authenticated ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY email_links_select_authenticated ON public.email_links FOR SELECT TO authenticated USING (true);
CREATE POLICY email_events_select_authenticated ON public.email_events FOR SELECT TO authenticated USING (true);
CREATE POLICY automation_flows_select_authenticated ON public.automation_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY automation_enrollments_select_authenticated ON public.automation_enrollments FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.lists TO authenticated;
GRANT SELECT ON public.subscribers TO authenticated;
GRANT SELECT ON public.tags TO authenticated;
GRANT SELECT ON public.subscriber_tags TO authenticated;
GRANT SELECT ON public.subscriber_lists TO authenticated;
GRANT SELECT ON public.campaigns TO authenticated;
GRANT SELECT ON public.email_links TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT SELECT ON public.automation_flows TO authenticated;
GRANT SELECT ON public.automation_enrollments TO authenticated;
