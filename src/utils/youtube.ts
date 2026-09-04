/** YouTube video ID z běžných i live odkazů (`watch`, `youtu.be`, `/live/`, embed, Shorts). */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const pats = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    /studio\.youtube\.com\/video\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of pats) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}
