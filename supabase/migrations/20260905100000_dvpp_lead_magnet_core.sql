-- DVPP zdarma jako lead magnet — jádro datového modelu (krok 1).
-- Dokumentace: docs/dvpp/DATOVY_MODEL.md. Zápis přes service_role (Edge funkce), staff jen SELECT.
--
-- Co přidává:
--   schools            rejstřík škol jako tabulka (místo CSV v paměti) + velikost sboru + stav školy
--   subscribers.*      vazba kontakt → škola (RED_IZO), typ učitele z kvízu, kdo ho přivedl, DVPP profil
--   dvpp_sessions      přihlášení magic linkem (hash tokenu, expirace)
--   staffrooms         „sborovna“ školy: milník, počet potvrzených, stav (building/unlocked/grace/expired)
--   staffroom_members  kdo se ke sborovně přidal a jak
--   referrals          „vzkaz kolegovi“ v režimu WP29 (bez pobídky za odeslání; adresa se maže)
--   certificates       vystavená osvědčení DVPP (police certifikátů, výkaz pro ředitele)
--   dvpp_progress      rozkoukané záznamy („pokračovat ve sledování“)
--   content_topics/votes  hlasování „natočíme příště“
--   funnel_events      jediný zdroj pravdy pro KPI strom (pixel a GA4 jsou jen pro nákup reklamy)

-- ── enum: nový zdroj kontaktu ────────────────────────────────────────────────
ALTER TYPE public.subscriber_source ADD VALUE IF NOT EXISTS 'dvpp';

-- ── schools ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
  red_izo TEXT PRIMARY KEY CHECK (red_izo ~ '^\d{9}$'),
  izo TEXT,
  ico TEXT CHECK (ico IS NULL OR ico ~ '^\d{8}$'),
  name TEXT NOT NULL,
  type TEXT,                                    -- ZŠ / MŠ / SŠ / ZUŠ / … (z rejstříku)
  is_primary BOOLEAN NOT NULL DEFAULT false,    -- true = základní škola (cílová skupina)
  street TEXT, city TEXT, zip TEXT, region TEXT, district TEXT,
  director_name TEXT, email TEXT, phone TEXT, web TEXT,
  founder_type TEXT,                            -- obec / kraj / soukromá / církevní / stát
  pupils_count INT,
  teachers_count INT,                           -- fyzické osoby (výkaz MŠMT), nebo odhad
  teachers_estimated BOOLEAN NOT NULL DEFAULT true,
  domain TEXT,                                  -- doména školního e-mailu (lower), pro auto-párování
  status TEXT NOT NULL DEFAULT 'blank'
    CHECK (status IN ('customer', 'staffroom', 'active', 'trace', 'blank', 'lost')),
  status_reason TEXT,                           -- proč tam nejsme (výběr + poznámka)
  status_note TEXT,
  pipedrive_status TEXT,
  pipedrive_synced_at TIMESTAMPTZ,
  first_contact_at TIMESTAMPTZ,
  milestone_reached_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'registry',      -- registry / manual
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS schools_ico_idx ON public.schools (ico) WHERE ico IS NOT NULL;
CREATE INDEX IF NOT EXISTS schools_domain_idx ON public.schools (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS schools_name_idx ON public.schools (lower(name));
CREATE INDEX IF NOT EXISTS schools_status_idx ON public.schools (status);
CREATE INDEX IF NOT EXISTS schools_primary_idx ON public.schools (is_primary) WHERE is_primary;

COMMENT ON TABLE public.schools IS
  'Jeden řádek na školu z rejstříku MŠMT. Klíč RED_IZO (ředitelství). IČO jen 8 číslic.';
COMMENT ON COLUMN public.schools.teachers_count IS
  'Fyzické osoby pedagogů. teachers_estimated=true = odhad z počtu žáků (cca 1 učitel na 12 žáků, min. 3).';
COMMENT ON COLUMN public.schools.status IS
  'customer = licence · staffroom = milník splněn · active = 3+ kontakty · trace = 1–2 · blank = 0 · lost = všichni odhlášení';

DROP TRIGGER IF EXISTS tr_schools_set_updated_at ON public.schools;
CREATE TRIGGER tr_schools_set_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ── subscribers: vazba na školu, profil ──────────────────────────────────────
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS school_red_izo TEXT REFERENCES public.schools(red_izo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_type TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dvpp_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dvpp_first_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dvpp_last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS subscribers_school_red_izo_idx
  ON public.subscribers (school_red_izo) WHERE school_red_izo IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscribers_referred_by_idx
  ON public.subscribers (referred_by) WHERE referred_by IS NOT NULL;

COMMENT ON COLUMN public.subscribers.school_red_izo IS
  'Škola kontaktu (RED_IZO). Plní registrace na webinář, profil v knihovně, párování domény.';
COMMENT ON COLUMN public.subscribers.teacher_type IS
  'Výsledek kvízu „Jaký jste učitel“ (badatel / trener / vypravec / architekt …).';
COMMENT ON COLUMN public.subscribers.dvpp_profile IS
  'Odpovědi z kvízu a progressive profilingu: subjects[], stages[], role, dvpp_hours_need, pain_point, decides, …';

-- ── dvpp_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dvpp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,              -- sha256(token); token zná jen prohlížeč
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  user_agent TEXT,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS dvpp_sessions_subscriber_idx ON public.dvpp_sessions (subscriber_id);

-- ── staffrooms ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staffrooms (
  red_izo TEXT PRIMARY KEY REFERENCES public.schools(red_izo) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,                    -- školní kód pro sdílení (dvppzdarma.cz/s/{code})
  founder_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  milestone_target INT NOT NULL CHECK (milestone_target BETWEEN 1 AND 100),
  confirmed_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'building'
    CHECK (status IN ('building', 'unlocked', 'grace', 'expired')),
  unlocked_by TEXT CHECK (unlocked_by IN ('milestone', 'director', 'customer', 'manual')),
  unlocked_at TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.staffrooms IS
  'Sborovna školy. Milník podle velikosti sboru (4/8/12/16). Status přepočítává cron /cron/dvpp-recount.';

DROP TRIGGER IF EXISTS tr_staffrooms_set_updated_at ON public.staffrooms;
CREATE TRIGGER tr_staffrooms_set_updated_at
  BEFORE UPDATE ON public.staffrooms
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

CREATE TABLE IF NOT EXISTS public.staffroom_members (
  red_izo TEXT NOT NULL REFERENCES public.staffrooms(red_izo) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  via TEXT NOT NULL DEFAULT 'link'
    CHECK (via IN ('founder', 'link', 'code', 'director', 'domain', 'registration', 'referral', 'manual')),
  invited_by UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  activated_at TIMESTAMPTZ,                     -- první přehrání ≥ 3 min nebo certifikát
  PRIMARY KEY (red_izo, subscriber_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS staffroom_members_subscriber_key
  ON public.staffroom_members (subscriber_id);   -- jedna škola na kontakt
CREATE INDEX IF NOT EXISTS staffroom_members_invited_by_idx
  ON public.staffroom_members (invited_by) WHERE invited_by IS NOT NULL;

-- ── referrals („vzkaz kolegovi“, režim WP29) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  red_izo TEXT REFERENCES public.staffrooms(red_izo) ON DELETE SET NULL,
  invitee_email TEXT,                           -- maže se po 14 dnech bez potvrzení (cron)
  invitee_email_hash TEXT NOT NULL,             -- sha256, zůstává kvůli limitům a dedupu
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'confirmed', 'expired', 'bounced')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  confirmed_at TIMESTAMPTZ,
  confirmed_subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  review_flag TEXT                              -- anti-fraud: same_ip / burst / alias / disposable
);
CREATE INDEX IF NOT EXISTS referrals_inviter_idx ON public.referrals (inviter_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS referrals_email_hash_idx ON public.referrals (invitee_email_hash);

-- ── certificates ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,                  -- VB-DVPP-{rok}-{6 znaků} (stejné jako PDF)
  kind TEXT NOT NULL DEFAULT 'dvpp' CHECK (kind IN ('dvpp', 'feedback', 'series', 'champion')),
  webinar_id TEXT,
  video_id TEXT,
  series_id TEXT,
  title TEXT NOT NULL,
  hours NUMERIC(4,1) NOT NULL DEFAULT 2,
  lecturer TEXT,
  holder_name TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  pdf_url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS certificates_subscriber_idx ON public.certificates (subscriber_id, issued_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS certificates_one_per_program
  ON public.certificates (subscriber_id, kind, coalesce(webinar_id, ''), coalesce(video_id, ''), coalesce(series_id, ''));

-- ── dvpp_progress ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dvpp_progress (
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  position_seconds INT NOT NULL DEFAULT 0,
  duration_seconds INT,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (subscriber_id, video_id)
);
CREATE INDEX IF NOT EXISTS dvpp_progress_updated_idx ON public.dvpp_progress (subscriber_id, updated_at DESC);

-- ── hlasování ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_topics (
  id TEXT PRIMARY KEY,                          -- slug
  title TEXT NOT NULL,
  description TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'scheduled', 'done', 'archived')),
  votes_count INT NOT NULL DEFAULT 0,
  scheduled_webinar_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS public.content_votes (
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (subscriber_id, topic_id)
);

-- ── funnel_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,                          -- visit, lead, confirmed, profile_done, play, certificate, invite_shared, invite_confirmed, staffroom_unlocked, …
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  email_hash TEXT,                              -- sha256(lower(email)) — i pro anonymní kroky před potvrzením
  red_izo TEXT,
  source TEXT, medium TEXT, campaign TEXT, content TEXT,   -- UTM
  referrer_id UUID,
  session_key TEXT,                             -- anonymní klíč prohlížeče (vb_id) pro spojení návštěvy s leadem
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS funnel_events_event_time_idx ON public.funnel_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_subscriber_idx ON public.funnel_events (subscriber_id) WHERE subscriber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS funnel_events_red_izo_idx ON public.funnel_events (red_izo) WHERE red_izo IS NOT NULL;
CREATE INDEX IF NOT EXISTS funnel_events_time_idx ON public.funnel_events (created_at DESC);

COMMENT ON TABLE public.funnel_events IS
  'Jediný zdroj pravdy pro KPI strom DVPP zdarma. Meta CAPI a GA4 dostávají kopii, reporting jde odsud.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dvpp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dvpp_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools', 'dvpp_sessions', 'staffrooms', 'staffroom_members', 'referrals',
    'certificates', 'dvpp_progress', 'content_topics', 'content_votes', 'funnel_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff_email())',
      t || '_select_staff', t
    );
  END LOOP;
END $$;

GRANT SELECT ON
  public.schools, public.dvpp_sessions, public.staffrooms, public.staffroom_members,
  public.referrals, public.certificates, public.dvpp_progress, public.content_topics,
  public.content_votes, public.funnel_events
TO authenticated;

GRANT ALL ON
  public.schools, public.dvpp_sessions, public.staffrooms, public.staffroom_members,
  public.referrals, public.certificates, public.dvpp_progress, public.content_topics,
  public.content_votes, public.funnel_events
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.funnel_events_id_seq TO service_role;

-- ── výchozí témata k hlasování (lze upravit v adminu) ────────────────────────
INSERT INTO public.content_topics (id, title, description, subjects) VALUES
  ('tridnicke-hodiny', 'Třídnické hodiny, které mají smysl', 'Jak vést třídnickou hodinu tak, aby ji děti chtěly.', '{}'),
  ('wellbeing-ucitele', 'Wellbeing učitele: jak nevyhořet do Vánoc', 'Praktické rutiny pro sborovnu i pro sebe.', '{}'),
  ('ai-v-priprave', 'AI v přípravě hodiny za 15 minut', 'Konkrétní postupy s ukázkami pro ZŠ.', '{}'),
  ('diferenciace-2-stupen', 'Diferenciace na 2. stupni bez tří příprav', 'Jedna hodina, tři úrovně, jeden učitel.', '{matematika,fyzika,chemie,prirodopis}'),
  ('formativni-hodnoceni', 'Formativní hodnocení, které nezabere víc času', 'Techniky do každé hodiny.', '{}'),
  ('badatelska-vyuka-1-stupen', 'Bádáme na 1. stupni: pokračování', 'Další pokusy a aktivity k prvouce.', '{prvouka}')
ON CONFLICT (id) DO NOTHING;
