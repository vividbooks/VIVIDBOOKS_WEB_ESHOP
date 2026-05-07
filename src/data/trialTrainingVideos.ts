/** Miniškolení (YouTube) po schválení trial — název, popis a náhled pro každé video. */
export interface TrialTrainingVideo {
  readonly href: string;
  readonly videoId: string;
  readonly title: string;
  readonly description: string;
}

/** Oficiální náhled z YouTube (hqdefault funguje pro všechna veřejná videa). */
export function youtubeTrainingThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export const TRIAL_TRAINING_VIDEOS: readonly TrialTrainingVideo[] = [
  {
    href: 'https://www.youtube.com/watch?v=H_L7V4iu228&t=66s',
    videoId: 'H_L7V4iu228',
    title: 'Online rozhraní pro fyziku, přírodopis a chemii',
    description:
      'Krátké představení práce s digitálními učebnicemi pro fyziku, přírodopis a chemii.',
  },
  {
    href: 'https://www.youtube.com/watch?v=sMXor8VBlE8&t=2s',
    videoId: 'sMXor8VBlE8',
    title: 'Online rozhraní Matematiky pro 2. stupeň',
    description:
      'Ukázka ovládání online rozhraní a práce s digitální Matematikou pro 2. stupeň.',
  },
  {
    href: 'https://www.youtube.com/watch?v=8qruYt57TC8&t=3s',
    videoId: '8qruYt57TC8',
    title: 'Online rozhraní pro 1. stupeň',
    description:
      'Ukázka online rozhraní pro materiály Vividbooks určené pro 1. stupeň.',
  },
];
