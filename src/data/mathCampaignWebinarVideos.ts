import type { YoutubePlaylistVideo } from '../components/YouTubePlaylistSlider';

function campaignRecordingVideo(id: string, title: string, thumbnail: string): YoutubePlaylistVideo {
  return {
    id,
    title,
    thumbnail,
    url: `https://www.vividbooks.com/webinare/zaznam/${id}`,
    published: '',
  };
}

/** DVPP / metodické webináře pro kampaň Matematika 2. stupeň (pořadí dle zadání). */
export const MATH_CAMPAIGN_WEBINAR_VIDEOS: YoutubePlaylistVideo[] = [
  campaignRecordingVideo(
    '69aaaafe5c6ac28075b4d82d',
    'Jak na nová témata podle nového RVP',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/69844dc899c1db460d8b0432_nova%20temata.png',
  ),
  campaignRecordingVideo(
    '699e11a62ac6b2499623464a',
    'Nový nástroj na rýsování zdarma',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/699e1197153d8fa088d268b8_rysovani2.png',
  ),
  campaignRecordingVideo(
    '6983be8e50c10f98d8bd7821',
    'Jak na procenta ve Vividbooks Matematice',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/6983be833e9984c023f06ed6_Mat9_d1dasa.png',
  ),
  campaignRecordingVideo(
    '690b01e067b7418d4ef74a13',
    'Jak na práci s jednotkami ve Vividbooks Matematice',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/68b7e41fb98eacd86b71532f_Mats9_1daa.avif',
  ),
  campaignRecordingVideo(
    '68dd1d9b2b1b7891d2542490',
    'Jak na úlohy s úměrností',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/68dd1d80192927416bc37d9a_Jak%20na%20%E2%80%A8u%CC%81lohy%20%E2%80%A8s%20u%CC%81me%CC%8Crnosti%CC%81.png',
  ),
  campaignRecordingVideo(
    '68b7df402f3be26905fc1ec6',
    'Jak rozmluvit žáky v matematice',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/68b7debf64934091a84ca1b1_Frame%202826saff.png',
  ),
  campaignRecordingVideo(
    '683f67b82b695718e18a42d7',
    'Jak na geometrii a rýsování ve Vividbooks Matematice',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/683f675cce487aaecbaa730b_Mat9_1dasd.png',
  ),
  campaignRecordingVideo(
    '69844dc053071dd863df67fa',
    'Jak na zlomky a desetinná čísla',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/69844d839b46a4c4359c27b7_jak%20na%20zlomky.png',
  ),
  campaignRecordingVideo(
    '69844e2a04edf0560b7c1219',
    'Jak na algebraické výrazy',
    'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/69844dfa99c1db460d8b0e43_algebraicke%20vyrazy.png',
  ),
];
