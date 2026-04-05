import type { Webinar, WebinarSurveyQuestion } from '../data/webinars';

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
