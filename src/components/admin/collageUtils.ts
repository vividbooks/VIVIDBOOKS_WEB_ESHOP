import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H_NO_CT = { 'Authorization': `Bearer ${publicAnonKey}` };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

/** Deterministický rozptyl pro „Rozsyp“ — při posuvech sliderů layout neskočí (stejný seed = stejné úhly). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vrstvený stín obálky — stejná logika jako `ImageGallery` (záložka Koláže). */
function drawBookShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  ctx.shadowColor = 'rgba(10,15,60,0.10)';
  ctx.shadowBlur = 55;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  roundRect(ctx, x, y, w, h, rad);
  ctx.fill();
  ctx.shadowColor = 'rgba(8,18,70,0.22)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  roundRect(ctx, x, y, w, h, rad);
  ctx.fill();
  ctx.shadowColor = 'rgba(5,12,55,0.38)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  roundRect(ctx, x, y, w, h, rad);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawBookShadowC(ctx: CanvasRenderingContext2D, w: number, h: number, rad: number) {
  drawBookShadow(ctx, -w / 2, -h / 2, w, h, rad);
}

export type CollageCanvasStyle = 'scattered' | 'grid' | 'fan';

/**
 * Canvas koláž z URL — sdílená implementace s `ImageGallery` (Koláže).
 * Vějíř / rozsyp / mřížka včetně měřítka a stínů jako v administraci galerie.
 */
export async function generateCollageDataUrl(
  imageUrls: string[],
  options?: {
    cols?: number;
    padding?: number;
    bg?: string;
    rounded?: number;
    style?: CollageCanvasStyle;
    /** 40–200, výchozí 100 — jako „Velikost prvků“ v ImageGallery. */
    bookScale?: number;
    /**
     * Volitelný seed pro náhodné otočení/posun u stylu „scattered“.
     * Když není zadán, chová se jako dřív (Math.random při každém volání).
     */
    scatterSeed?: number;
  },
): Promise<string | null> {
  if (imageUrls.length === 0) return null;

  const {
    cols: colsOpt = 3,
    padding = 12,
    bg = '#F8F7FF',
    rounded: r = 12,
    style = 'scattered',
    bookScale: bookScalePct = 100,
    scatterSeed,
  } = options || {};

  const rnd =
    scatterSeed !== undefined && style === 'scattered'
      ? mulberry32(scatterSeed)
      : null;
  const rand = () => (rnd ? rnd() : Math.random());

  const _bScale = Math.min(200, Math.max(40, bookScalePct)) / 100;

  const loaded: HTMLImageElement[] = [];
  for (const url of imageUrls) {
    try {
      loaded.push(await loadImage(url));
    } catch {
      console.warn(`[Collage] Skipped: ${url}`);
    }
  }
  if (loaded.length === 0) return null;

  if (loaded.length === 1) {
    return null;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (style === 'scattered') {
    const bW = Math.round(108 * _bScale);
    const bH = Math.round(150 * _bScale);
    const count = loaded.length;
    const cols = Math.min(colsOpt, count);
    const rows = Math.ceil(count / cols);
    const spX = bW + padding + 44;
    const spY = bH + padding + 55;
    const mg = 72;
    canvas.width = cols * spX + mg * 2;
    canvas.height = rows * spY + mg * 2;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 24);
    ctx.fill();
    const rots = loaded.map((_, i) => {
      const b = [-8, 5, -4, 6, -5, 4, -7, 3, -3, 7, -4.5, 5.5];
      return b[i % b.length] + (rand() - 0.5) * 2.5;
    });
    const offs = loaded.map(() => ({ dx: (rand() - 0.5) * 18, dy: (rand() - 0.5) * 14 }));
    for (let i = 0; i < loaded.length; i++) {
      const cx = mg + (i % cols) * spX + spX / 2 + offs[i].dx;
      const cy = mg + Math.floor(i / cols) * spY + spY / 2 + offs[i].dy;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rots[i] * Math.PI) / 180);
      drawBookShadowC(ctx, bW, bH, r);
      ctx.save();
      roundRect(ctx, -bW / 2, -bH / 2, bW, bH, r);
      ctx.clip();
      const img = loaded[i];
      const sc = Math.max(bW / img.width, bH / img.height);
      ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
      ctx.restore();
      ctx.restore();
    }
  } else if (style === 'fan') {
    const bW = Math.round(96 * _bScale);
    const bH = Math.round(132 * _bScale);
    const count = loaded.length;
    const spread = Math.min(count * 12, 70);
    canvas.width = Math.max(680, count * 88);
    canvas.height = 400;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 24);
    ctx.fill();
    const cx = canvas.width / 2;
    const cy = canvas.height + 88;
    for (let i = 0; i < loaded.length; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const a = (t * spread * Math.PI) / 180;
      const x = cx + Math.sin(a) * 330;
      const y = cy - Math.cos(a) * 330;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      drawBookShadowC(ctx, bW, bH, r);
      ctx.save();
      roundRect(ctx, -bW / 2, -bH / 2, bW, bH, r);
      ctx.clip();
      const img = loaded[i];
      const sc = Math.max(bW / img.width, bH / img.height);
      ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
      ctx.restore();
      ctx.restore();
    }
  } else {
    const cols = Math.min(colsOpt, loaded.length);
    const rows = Math.ceil(loaded.length / cols);
    const cW = Math.round(144 * _bScale);
    const cH = Math.round(192 * _bScale);
    const pad = padding;
    canvas.width = cols * (cW + pad) + pad;
    canvas.height = rows * (cH + pad) + pad;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 20);
    ctx.fill();
    for (let i = 0; i < loaded.length; i++) {
      const x = pad + (i % cols) * (cW + pad);
      const y = pad + Math.floor(i / cols) * (cH + pad);
      drawBookShadow(ctx, x, y, cW, cH, r);
      ctx.save();
      roundRect(ctx, x, y, cW, cH, r);
      ctx.clip();
      const img = loaded[i];
      const sc = Math.max(cW / img.width, cH / img.height);
      ctx.drawImage(
        img,
        x + (cW - img.width * sc) / 2,
        y + (cH - img.height * sc) / 2,
        img.width * sc,
        img.height * sc,
      );
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

function escapeHtmlAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Obálky vedle sebe v e-mailu jako tabulka — bez canvasu, bez PNG a bez AI.
 */
export function buildEmailProductImagesTableHtml(
  items: { url: string; title?: string }[],
  cols = 3,
): string {
  if (items.length === 0) return '';
  const n = Math.min(Math.max(Math.floor(cols), 1), 5);
  const w = Math.round(100 / n);
  let html =
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;">';
  for (let i = 0; i < items.length; i += n) {
    html += '<tr>';
    for (let j = 0; j < n; j++) {
      const idx = i + j;
      if (idx < items.length) {
        const it = items[idx];
        const url = escapeHtmlAttr(it.url);
        const alt = escapeHtmlAttr((it.title || 'Produkt').slice(0, 120));
        html += `<td width="${w}%" style="padding:5px;vertical-align:top;text-align:center;">`;
        html += `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />`;
        html += '</td>';
      } else {
        html += `<td width="${w}%"></td>`;
      }
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

/**
 * Upload a data URL as PNG to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadCollageToStorage(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `collage-auto-${Date.now()}.png`, { type: 'image/png' });
    const fd = new FormData();
    fd.append('file', file);
    const uRes = await fetch(`${SERVER}/upload-image`, {
      method: 'POST',
      headers: AUTH_H_NO_CT,
      body: fd,
    });
    const uData = await uRes.json();
    if (uData.url) {
      console.log(`[Collage] Uploaded: ${uData.url}`);
      return uData.url;
    }
    console.error(`[Collage] Upload failed:`, uData.error);
    return null;
  } catch (e: any) {
    console.error(`[Collage] Upload error: ${e.message}`);
    return null;
  }
}

/**
 * Full pipeline: generate collage from URLs → upload → return storage URL.
 */
export async function autoGenerateCollage(
  imageUrls: string[],
  style: 'scattered' | 'grid' | 'fan' = 'scattered'
): Promise<{ collageUrl: string | null; singleImageUrl: string | null }> {
  if (imageUrls.length === 0) return { collageUrl: null, singleImageUrl: null };

  // Single image — don't make a collage, just use directly
  if (imageUrls.length === 1) {
    return { collageUrl: null, singleImageUrl: imageUrls[0] };
  }

  const dataUrl = await generateCollageDataUrl(imageUrls, { style });
  if (!dataUrl) return { collageUrl: null, singleImageUrl: null };

  const url = await uploadCollageToStorage(dataUrl);
  return { collageUrl: url, singleImageUrl: null };
}
