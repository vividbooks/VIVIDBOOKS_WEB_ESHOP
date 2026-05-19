import type { YoutubePlaylistVideo } from '../components/YouTubePlaylistSlider';

/** Playlist Metodika Vividbooks matematiky — kompletní seznam (32 videí). */
export const MATH_METHODOLOGY_PLAYLIST_ID = 'PL8hxTABQdSembpjgKu29VEzzY4Rw3NyjY';

export const MATH_METHODOLOGY_PLAYLIST_URL =
  `https://www.youtube.com/playlist?list=${MATH_METHODOLOGY_PLAYLIST_ID}`;

export const MATH_METHODOLOGY_PLAYLIST_VIDEOS: YoutubePlaylistVideo[] = [
  { id: 'QzfVPsl8AKo', title: 'Jak pracovat s Vividbooks matematikou', thumbnail: '', url: '', published: '' },
  { id: 'mT05sZG2yeA', title: 'Metodika Vividbooks matematiky: Délka, obvod a obsah', thumbnail: '', url: '', published: '' },
  { id: 'ZpsYovTkcRk', title: 'Metodika Vividbooks matematiky: Početní operace s desetinnými čísly', thumbnail: '', url: '', published: '' },
  { id: 'xY5ESyjBvWU', title: 'Metodika Vividbooks matematiky: Necelá (racionální) čísla', thumbnail: '', url: '', published: '' },
  { id: 'm0Shc6IaOFI', title: 'Metodika Vividbooks matematiky: Jednoduchá tělesa a jejich sítě, Povrch a objem těles', thumbnail: '', url: '', published: '' },
  { id: 'QyLiUDVAsVc', title: 'Metodika Vividbooks matematiky: Pokročilé převody jednotek', thumbnail: '', url: '', published: '' },
  { id: 'ZSRaIvLwjxw', title: 'Metodika Vividbooks matematiky: Práce s přirozenými čísly', thumbnail: '', url: '', published: '' },
  { id: 'zdY3j3mrxpk', title: 'Metodika Vividbooks matematiky: Základní konstrukce', thumbnail: '', url: '', published: '' },
  { id: 'i7l4giOsJc4', title: 'Metodika Vividbooks matematiky: Úhel', thumbnail: '', url: '', published: '' },
  { id: 'kCDenm2Rg70', title: 'Metodika Vividbooks matematiky: Osová a středová souměrnost', thumbnail: '', url: '', published: '' },
  { id: '0IhFoGW-VWo', title: 'Metodika Vividbooks matematiky: Aritmetický průměr', thumbnail: '', url: '', published: '' },
  { id: 'AP-SM74nZek', title: 'Metodika Vividbooks matematiky: Početní operace se zlomky I', thumbnail: '', url: '', published: '' },
  { id: '9Fs0RYapb_E', title: 'Metodika Vividbooks matematiky: Početní operace se zlomky II', thumbnail: '', url: '', published: '' },
  { id: 'TG1YOP9oBy4', title: 'Metodika Vividbooks matematiky: Trojúhelník', thumbnail: '', url: '', published: '' },
  { id: 'UQ9wwgfNlQI', title: 'Metodika Vividbooks matematiky: Úměrnost', thumbnail: '', url: '', published: '' },
  { id: 'QyQIrosZBY0', title: 'Metodika Vividbooks matematiky: Záporná čísla', thumbnail: '', url: '', published: '' },
  { id: 'IJnD8ixc96A', title: 'Metodika Vividbooks matematiky: Poměr', thumbnail: '', url: '', published: '' },
  { id: 'R9R92AS5zGE', title: 'Metodika Vividbooks matematiky: Procenta', thumbnail: '', url: '', published: '' },
  { id: 'dUeNtnE4S5o', title: 'Metodika Vividbooks matematiky: Rovnoběžníky', thumbnail: '', url: '', published: '' },
  { id: 'W7-6iJqQQXM', title: 'Metodika Vividbooks matematiky: Obvod a obsah trojúhelníku', thumbnail: '', url: '', published: '' },
  { id: 'sJ8zN0Nt5kw', title: 'Metodika Vividbooks matematiky: Lichoběžník', thumbnail: '', url: '', published: '' },
  { id: 'dVWu1FbcKdA', title: 'Metodika Vividbooks matematiky: Pokročilá práce s procenty', thumbnail: '', url: '', published: '' },
  { id: 't2VnSPooXKU', title: 'Metodika Vividbooks matematiky: Mocnina a odmocnina', thumbnail: '', url: '', published: '' },
  { id: 'ahzgjQtn0MA', title: 'Metodika Vividbooks matematiky: Pythagorova věta', thumbnail: '', url: '', published: '' },
  { id: 'DyiX8LPx3QQ', title: 'Metodika Vividbooks matematiky: Úvod do algebraických výrazů', thumbnail: '', url: '', published: '' },
  { id: 'fapMjkqlEAY', title: 'Metodika Vividbooks Matematiky: Obvod a obsah kruhu', thumbnail: '', url: '', published: '' },
  { id: 'qNL0LHRm2zg', title: 'Metodika Vividbooks matematiky: Vzájemná poloha přímky a kružnice', thumbnail: '', url: '', published: '' },
  { id: 'TfgTbGakO3U', title: 'Metodika Vividbooks matematiky: Pokročilé úpravy algebraických výrazů', thumbnail: '', url: '', published: '' },
  { id: 'GM3Wv1wEr80', title: 'Metodika Vividbooks matematiky: Rovnice a jejich využití', thumbnail: '', url: '', published: '' },
  { id: 'oo0I06br_G8', title: 'Metodika Vividbooks matematiky: Thaletova věta', thumbnail: '', url: '', published: '' },
  { id: '5GXJpHB2hBc', title: 'Metodika Vividbooks matematiky: Pokročilé konstrukční úlohy', thumbnail: '', url: '', published: '' },
  { id: 'wosq0s01zs4', title: 'Metodika Vividbooks Matematiky: Hledání bodů splňujících danou podmínku', thumbnail: '', url: '', published: '' },
].map((v) => ({
  ...v,
  thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  url: `https://www.youtube.com/watch?v=${v.id}`,
}));

/** @deprecated Použijte MATH_METHODOLOGY_PLAYLIST_VIDEOS */
export const MATH_METHODOLOGY_PLAYLIST_FALLBACK = MATH_METHODOLOGY_PLAYLIST_VIDEOS;
