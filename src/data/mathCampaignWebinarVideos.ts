import type { YoutubePlaylistVideo } from '../components/YouTubePlaylistSlider';

function campaignVideo(id: string, title: string): YoutubePlaylistVideo {
  return {
    id,
    title,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    published: '',
  };
}

/** DVPP / metodické webináře pro kampaň Matematika 2. stupeň (pořadí dle zadání). */
export const MATH_CAMPAIGN_WEBINAR_VIDEOS: YoutubePlaylistVideo[] = [
  campaignVideo('kuvdzNNlIdU', 'Jak na nová témata podle nového RVP'),
  campaignVideo('wS8TkCaPMP8', 'Nový nástroj na rýsování zdarma'),
  campaignVideo('DmZnExZ8GUg', 'Jak na procenta ve Vividbooks Matematice'),
  campaignVideo('bdHPeg2Cznw', 'Jak na práci s jednotkami ve Vividbooks Matematice'),
  campaignVideo('X1a7GmEWz4o', 'Jak na úlohy s úměrností'),
  campaignVideo('lW5okLT7h40', 'Jak rozmluvit žáky v matematice'),
  campaignVideo('QO6u8FjDjOw', 'Jak na geometrii a rýsování ve Vividbooks Matematice'),
  campaignVideo('Qyw4xUYjxGk', 'Jak na zlomky a desetinná čísla'),
  campaignVideo('sDM-TxKfMx0', 'Jak na algebraické výrazy'),
];
