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
    title: 'Úvod do Vividbooks',
    description:
      'Přihlášení žáka i učitele, základní ovládání aplikace a kde najdete hlavní nabídky.',
  },
  {
    href: 'https://www.youtube.com/watch?v=sMXor8VBlE8&t=2s',
    videoId: 'sMXor8VBlE8',
    title: 'Digitální učebnice v praxi',
    description:
      'Jak listovat učebnicí, pracovat s přehledem a využívat interaktivní prvky na stránkách.',
  },
  {
    href: 'https://www.youtube.com/watch?v=8qruYt57TC8&t=3s',
    videoId: '8qruYt57TC8',
    title: 'Tipy pro výuku s Vividbooks',
    description:
      'Krátké doporučení, jak začlenit Vividbooks do hodiny krok za krokem — bez zbytečné administrativy.',
  },
];
