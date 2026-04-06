import type {
  PostWebinarPart2Step,
  Webinar,
  WebinarSurveyQuestion,
} from '../data/webinars';

/** DVPP kvíz z administrace → stejný tvar jako `abc` v dotazníku (pro sloučení a odeslání). */
/** Výchozí druhá část (zpětná vazba) — lze přepsat `webinar.postWebinarPart2` v CMS / API. */
export const DEFAULT_POST_WEBINAR_PART2_STEPS: PostWebinarPart2Step[] = [
  {
    type: 'intro',
    id: 'post-part2-intro',
    title: 'Dejte nám prosím zpětnou vazbu na webinář:',
  },
  {
    type: 'open',
    id: 'post-part2-liked',
    label: 'Jak se vám webinář líbil?',
    placeholder: 'Vaše odpověď',
  },
  {
    type: 'open',
    id: 'post-part2-improve',
    label: 'Jak bychom mohli Vividbooks nebo naše webináře ještě vylepšit?',
    placeholder: 'Vaše odpověď',
  },
  {
    type: 'abc',
    id: 'post-part2-trial',
    label:
      'Přejete si vyzkoušet Vividbooks nebo zaškolit Vaše kolegy? (DVPP školení zdarma pro celý tým)',
    options: [
      'Ano, chci vyzkoušet nebo zaškolit mé kolegy',
      'Ne, Vividbooks již testujeme',
      'Nemám zájem',
    ],
  },
  {
    type: 'open',
    id: 'post-part2-why-not',
    label: 'Pokud si nepřejete vyzkoušet Vividbooks, napište nám prosím proč ne.',
    sublabel: 'Vaše zpětná vazba nám pomůže vylepšit Vividbooks. Děkujeme!',
    placeholder: 'Vaše odpověď',
  },
];

export function getPostWebinarPart2Steps(webinar: Webinar): PostWebinarPart2Step[] {
  if (webinar.surveyEnabled === false) return [];
  if (webinar.postWebinarPart2 !== undefined) {
    if (!Array.isArray(webinar.postWebinarPart2) || webinar.postWebinarPart2.length === 0) {
      return [];
    }
    return webinar.postWebinarPart2.filter((s) => s && s.id && s.type);
  }
  return DEFAULT_POST_WEBINAR_PART2_STEPS;
}

/** Pro sloučení s dotazníkem a odesláním — bez úvodního kroku. */
export function getPostWebinarPart2AsSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  return getPostWebinarPart2Steps(webinar)
    .filter((s): s is Extract<PostWebinarPart2Step, { type: 'open' | 'abc' }> => s.type === 'open' || s.type === 'abc')
    .map((s) =>
      s.type === 'open'
        ? { id: s.id, type: 'open' as const, label: s.label }
        : { id: s.id, type: 'abc' as const, label: s.label, options: s.options.map((o) => String(o)) },
    );
}

export function getPostWebinarPart2AnswerIds(webinar: Webinar): Set<string> {
  return new Set(getPostWebinarPart2AsSurveyQuestions(webinar).map((q) => q.id));
}

export function webinarPostWebinarQuizAsSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  const raw = webinar.postWebinarQuizQuestions;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .filter(
      (q) =>
        q &&
        q.type === 'abc' &&
        typeof q.label === 'string' &&
        q.label.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2,
    )
    .map((q) => ({
      id: q.id,
      type: 'abc' as const,
      label: q.label,
      options: q.options.map((o) => String(o)),
    }));
}

/**
 * Dotazník **před** webinářem (motivace, témata, …) — bez DVPP kvízu z přepisu.
 * Pro odkazy z připomínek „Chci ovlivnit obsah“ a blok po registraci u nadcházejícího webináře.
 */
export function getPreWebinarSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  if (webinar.surveyEnabled === false) return [];
  return getResolvedWebinarSurveyQuestions(webinar);
}

/**
 * Další otázky **jen** pokud jsou u webináře vyplněné v CMS (`surveyQuestions`).
 * Výchozí tři otázky z kódu (`DEFAULT_WEBINAR_SURVEY_QUESTIONS`) jsou výhradně pro **před** webinářem — do sloučení po akci je nepřidáváme (jinak by po DVPP a zpětné vazbě následoval duplicitní „kdo přichází na webinář“).
 */
export function getPostWebinarExtraSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  if (webinar.surveyEnabled === false) return [];
  const q = webinar.surveyQuestions;
  if (Array.isArray(q) && q.length > 0) {
    return q.filter((x) => x && x.id && x.label && x.type);
  }
  return [];
}

/**
 * Dotazník **po** webináři: DVPP kvíz z přepisu, druhá část (zpětná vazba), volitelně další otázky z CMS.
 * Pokud je `surveyEnabled === false` a existuje DVPP kvíz, vrátí jen DVPP.
 */
export function getMergedWebinarSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  const dvpp = webinarPostWebinarQuizAsSurveyQuestions(webinar);
  const part2 = getPostWebinarPart2AsSurveyQuestions(webinar);
  if (webinar.surveyEnabled === false) {
    return dvpp.length > 0 ? dvpp : [];
  }
  return [...dvpp, ...part2, ...getPostWebinarExtraSurveyQuestions(webinar)];
}

/** Výchozí dotazník, pokud u webináře není nic v CMS. */
export const DEFAULT_WEBINAR_SURVEY_QUESTIONS: WebinarSurveyQuestion[] = [
  {
    id: 'motivation',
    type: 'open',
    label: 'S jakou motivací přicházíte na tento webinář?',
  },
  {
    id: 'topic_interest',
    type: 'open',
    label: 'Co by vás u tématu nejvíce zajímalo?',
  },
  {
    id: 'uses_vividbooks',
    type: 'yes_no',
    label: 'Používám Vividbooks',
  },
];

export function getResolvedWebinarSurveyQuestions(webinar: Webinar): WebinarSurveyQuestion[] {
  if (webinar.surveyEnabled === false) return [];
  const q = webinar.surveyQuestions;
  if (Array.isArray(q) && q.length > 0) {
    return q.filter((x) => x && x.id && x.label && x.type);
  }
  return DEFAULT_WEBINAR_SURVEY_QUESTIONS;
}
