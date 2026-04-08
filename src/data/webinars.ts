export interface Webinar {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  day: number;
  monthName: string;
  monthNum: number;
  year: number;
  time: string;
  /**
   * Odhadovaná délka (min). Používá se k automatickému přepnutí na „minulý“ po skončení
   * (začátek + délka) a v sekci Uplynulé webináře. Výchozí 120 min, lze přepsat env na serveru.
   */
  durationMinutes?: number;
  lecturer: string;
  lecturerAvatar: string;
  coverImage?: string;
  description: string;
  perks: string;
  targetAudience: string;
  zoomLink?: string;
  /**
   * Kde probíhá živý přenos na `/webinar/…/live`.
   * `google_meet` = jen odkaz na setkání (pole `zoomLink`), bez chatu na stránce.
   * `live_stream` = YouTube embed + chat vpravo (výchozí / dosavadní chování).
   */
  liveDeliveryMode?: 'google_meet' | 'live_stream';
  youtubeUrl?: string;
  thumbnailVariant: 1 | 2 | 3;
  isPast?: boolean;
  importedAt?: string;
  /**
   * Stránky /predmet/… — názvy jako v aplikaci (např. Matematika, Matematika 1. stupeň, Fyzika).
   * Bez vyplnění se páruje podle klíčových slov v názvu a popisu.
   */
  relatedSubjects?: string[];
  /** Volitelné štítky (např. „matematika“) — u záznamů ve slideru na Matematice filtrujeme podle nich i podle relatedSubjects. */
  tags?: string[];
  /** Krátká citátová věta na kartu ve slideru; jinak se bere z popisu. */
  highlightQuote?: string;
  /**
   * Přesný název tagu v Mailchimp (jako v Audience), pokud se liší od `webinar-{slug}`.
   * Např. „Jak na zlomky… – 7. 4. 2026 od 18.00“.
   */
  mailchimpTagName?: string;
  /**
   * Dotazník po úspěšné registraci (před blokem se zkušebním přístupem).
   * `surveyEnabled === false` vypne; prázdné `surveyQuestions` = výchozí tři otázky v kódu.
   */
  surveyEnabled?: boolean;
  surveyQuestions?: WebinarSurveyQuestion[];
  /**
   * Admin / vývoj: cron připomínek vynutí odeslání „Dnes vás čeká webinář“ (i mimo okno 7–10 h).
   * Veřejné API tento příznak nevrací.
   */
  devSimulateReminderMorning?: boolean;
  /**
   * Admin / vývoj: cron vynutí e-mail „Za chvíli začínáme“ (i mimo okno ~30 min před začátkem).
   * Stejné jako přepínač „Začíná za chvíli“ po uložení — pro test Mandrill šablon.
   */
  devSimulateReminderT30?: boolean;
  /**
   * Minulý webinář — otázky k ověření pochopení tématu (typicky z přepisu, pro DVPP).
   * Ve veřejném API se neposílá `correctIndex` (jen admin).
   */
  postWebinarQuizQuestions?: PostWebinarQuizQuestion[];
  /**
   * Krátké shrnutí po webináři (HTML) — styl blogu, blok „co jsme se dozvěděli“ do e-mailu / Mailchimp.
   */
  postWebinarLearningsHtml?: string;
  /**
   * Druhá část zpětné vazby po DVPP (slide průvodce). `undefined` = výchozí kroky z kódu;
   * prázdné pole `[]` = sekce vypnuta.
   */
  postWebinarPart2?: PostWebinarPart2Step[];
  /** Odkaz na externí vyžádání certifikátu (Google Form apod.) — z adminu / Webflow. */
  certificateUrl?: string;
  /** Text tlačítka k `certificateUrl` (např. „Certifikát DVPP“). */
  greyButtonText?: string;
  /**
   * Certifikát DVPP: `external` = vlastní URL (`certificateUrl`), `survey` = dotazník na webu (`/webinar/…/dvpp-dotaznik`).
   * Bez hodnoty se bere jako `external` (zpětná kompatibilita).
   */
  certificateLinkMode?: 'external' | 'survey';
  /**
   * Pokud `true` (výchozí), před záznamem a dotazníkem DVPP platí plná registrace jako u webináře.
   * Pokud `false`, stačí jméno, e-mail a telefon (záznam + `/webinar/…?dvppDotaznik=1`).
   */
  surveyRequireFullRegistration?: boolean;
  /**
   * Admin DEV: dočasný přepis URL žlutého tlačítka „Otevřít záznam webináře“ v follow-up e-mailu (po webináři).
   * Prázdné = výchozí `/webinare/zaznam/…?email&from=email`. Po nasazení smažte.
   */
  devFollowupRecordingUrl?: string;
  /**
   * Admin DEV: dočasný přepis modrého odkazu „Vyzkoušet Vividbooks…“ v follow-up e-mailu.
   * Prázdné = `orangeButtonLink`. Po nasazení smažte.
   */
  devFollowupTrialUrl?: string;
}

/** Kvíz po minulém webináři (výběr z možností). */
export interface PostWebinarQuizQuestion {
  id: string;
  type: 'abc';
  /** Text otázky */
  label: string;
  /** Přesně 4 možnosti */
  options: string[];
  /** Index správné odpovědi 0–3 — jen pro admin / vyhodnocení */
  correctIndex?: number;
}

/** Typ otázky: otevřená / výběr z možností / Ano–Ne */
export type WebinarSurveyQuestionType = 'open' | 'abc' | 'yes_no';

export interface WebinarSurveyQuestion {
  id: string;
  type: WebinarSurveyQuestionType;
  label: string;
  /** Pro `abc` — alespoň 2 možnosti */
  options?: string[];
}

/**
 * Druhá část dotazníku po webináři (slide průvodce, stejný „stage“ styl jako DVPP).
 * Úvodní krok se neodesílá; `open` / `abc` jdou do `answers` podle `id`.
 */
export type PostWebinarPart2Step =
  | { type: 'intro'; id: string; title: string; subtitle?: string }
  | {
      type: 'open';
      id: string;
      label: string;
      sublabel?: string;
      placeholder?: string;
    }
  | { type: 'abc'; id: string; label: string; options: string[] };

const AVATAR = 'https://images.unsplash.com/photo-1769628027250-d2a7a5a4eb64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFyZGVkJTIwbWFsZSUyMHRlYWNoZXIlMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzIzNTYzMDR8MA&ixlib=rb-4.1.0&q=80&w=200';

export const WEBINARS: Webinar[] = [
  {
    id: 'jak-na-nova-temata-rvp',
    title: 'Jak na nov\u00e1 t\u00e9mata podle nov\u00e9ho RVP',
    subtitle: 've Vividbooks Matematice.',
    day: 3,
    monthName: 'B\u0159ezen',
    monthNum: 3,
    year: 2026,
    time: '18:00',
    lecturer: 'Franti\u0161ek C\u00e1b',
    lecturerAvatar: AVATAR,
    relatedSubjects: ['Matematika', 'Matematika 1. stupe\u0148', 'Matematika 2. stupe\u0148'],
    highlightQuote:
      'Pod\u00edv\u00e1me se na glob\u00e1ln\u00ed referen\u010dn\u00ed r\u00e1mec, nov\u00e1 t\u00e9mata a jejich konkr\u00e9tn\u00ed zpracov\u00e1n\u00ed v pracovn\u00edch se\u0161itech.',
    description:
      'Na webin\u00e1\u0159i se zam\u011b\u0159\u00edme na zm\u011bny, kter\u00e9 p\u0159in\u00e1\u0161\u00ed do v\u00fduky matematiky nov\u00fd RVP. Pod\u00edv\u00e1me se na glob\u00e1ln\u00ed referen\u010dn\u00ed r\u00e1mec, nov\u00e1 t\u00e9mata a na jejich konkr\u00e9tn\u00ed zpracov\u00e1n\u00ed v pracovn\u00edch se\u0161itech Vividbooks Matematika.',
    perks:
      '\u00da\u010dastn\u00edci webin\u00e1\u0159e z\u00edsk\u00e1 p\u0159\u00edstup do aplikace Vividbooks zcela zdarma. Obdr\u017e\u00ed tak\u00e9 DVPP certifik\u00e1t.',
    targetAudience: 'Pro u\u010ditele matematiky',
    thumbnailVariant: 1,
    isPast: true,
  },
  {
    id: 'jak-na-zlomky-a-desetinna-cisla',
    title: 'Jak na zlomky a desetinn\u00e1 \u010d\u00edsla',
    subtitle: 've Vividbooks Matematice.',
    day: 7,
    monthName: 'Duben',
    monthNum: 4,
    year: 2026,
    time: '18:00',
    lecturer: 'Franti\u0161ek C\u00e1b',
    lecturerAvatar: AVATAR,
    relatedSubjects: ['Matematika', 'Matematika 1. stupe\u0148', 'Matematika 2. stupe\u0148'],
    highlightQuote:
      'Uk\u00e1\u017eeme si typick\u00e9 chyby \u017e\u00e1k\u016f u zlomk\u016f a desetinn\u00fdch \u010d\u00edsel \u2014 a jak jim p\u0159edch\u00e1zet.',
    description:
      'Na webin\u00e1\u0159i si uk\u00e1\u017eeme, jak efektivn\u011b vyu\u010dovat zlomky a desetinn\u00e1 \u010d\u00edsla s vyu\u017eit\u00edm pracovn\u00edch se\u0161it\u016f Vividbooks. Pod\u00edv\u00e1me se na typick\u00e9 chyby \u017e\u00e1k\u016f a jak jim p\u0159edch\u00e1zet.',
    perks:
      '\u00da\u010dastn\u00edci webin\u00e1\u0159e z\u00edsk\u00e1 p\u0159\u00edstup do aplikace Vividbooks zcela zdarma. Obdr\u017e\u00ed tak\u00e9 DVPP certifik\u00e1t.',
    targetAudience: 'Pro u\u010ditele matematiky',
    thumbnailVariant: 2,
  },
  {
    id: 'jak-na-algebraicke-vyrazy',
    title: 'Jak na algebraick\u00e9 v\u00fdrazy',
    subtitle: 've Vividbooks Matematice.',
    day: 5,
    monthName: 'Kv\u011bten',
    monthNum: 5,
    year: 2026,
    time: '9:00',
    lecturer: 'Franti\u0161ek C\u00e1b',
    lecturerAvatar: AVATAR,
    relatedSubjects: ['Matematika', 'Matematika 2. stupe\u0148'],
    highlightQuote:
      'Jak p\u0159ibl\u00ed\u017eit algebraick\u00e9 v\u00fdrazy zp\u016fsobem, kter\u00fd \u017e\u00e1k\u016fm d\u00e1v\u00e1 smysl \u2014 ne jako soubor pravidel z tabule.',
    description:
      'Algebraick\u00e9 v\u00fdrazy pat\u0159\u00ed mezi nejn\u00e1ro\u010dn\u011bj\u0161\u00ed t\u00e9mata 2. stupn\u011b. Na webin\u00e1\u0159i si uk\u00e1\u017eeme prost\u0159edky a strategie, jak toto t\u00e9ma p\u0159ibl\u00ed\u017eit \u017e\u00e1k\u016fm zp\u016fsobem, kter\u00fd jim d\u00e1v\u00e1 smysl.',
    perks:
      '\u00da\u010dastn\u00edci webin\u00e1\u0159e z\u00edsk\u00e1 p\u0159\u00edstup do aplikace Vividbooks zcela zdarma. Obdr\u017e\u00ed tak\u00e9 DVPP certifik\u00e1t.',
    targetAudience: 'Pro u\u010ditele matematiky',
    thumbnailVariant: 3,
  },
  {
    id: 'jak-na-geometrii-na-1-stupni',
    title: 'Jak na geometrii na 1.\u00a0stupni',
    subtitle: 've Vividbooks Matematice.',
    day: 10,
    monthName: '\u010cerven',
    monthNum: 6,
    year: 2026,
    time: '18:00',
    lecturer: 'Franti\u0161ek C\u00e1b',
    lecturerAvatar: AVATAR,
    relatedSubjects: ['Matematika', 'Matematika 1. stupe\u0148'],
    highlightQuote:
      'Geometrii na 1. stupni m\u016f\u017eete vyu\u010dovat hrav\u011b a s porozum\u011bn\u00edm \u2014 ne jen jako opakovac\u00ed blok.',
    description:
      'Geometrie na 1. stupni b\u00fdv\u00e1 \u010dasto opa\u010dovanou \u010d\u00e1st\u00ed u\u010debn\u00edho pl\u00e1nu. Uk\u00e1\u017eeme si, jak ji zasadit do kontextu a vyu\u010dovat ji hrav\u011b a s\u00a0porozum\u011bn\u00edm.',
    perks:
      '\u00da\u010dastn\u00edci webin\u00e1\u0159e z\u00edsk\u00e1 p\u0159\u00edstup do aplikace Vividbooks zcela zdarma. Obdr\u017e\u00ed tak\u00e9 DVPP certifik\u00e1t.',
    targetAudience: 'Pro u\u010ditele 1.\u00a0stupn\u011b',
    thumbnailVariant: 1,
  },
];