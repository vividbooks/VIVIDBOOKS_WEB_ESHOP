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

/**
 * Generate a "scattered book covers" collage from image URLs.
 * Returns a data URL (PNG).
 */
export async function generateCollageDataUrl(
  imageUrls: string[],
  options?: {
    cols?: number;
    padding?: number;
    bg?: string;
    rounded?: number;
    style?: 'scattered' | 'grid' | 'fan';
  }
): Promise<string | null> {
  if (imageUrls.length === 0) return null;

  const {
    cols: colsOpt = 3,
    padding = 12,
    bg = '#F8F7FF',
    rounded: r = 12,
    style = 'scattered',
  } = options || {};

  // Load images
  const loaded: HTMLImageElement[] = [];
  for (const url of imageUrls) {
    try {
      loaded.push(await loadImage(url));
    } catch {
      console.warn(`[Collage] Skipped: ${url}`);
    }
  }
  if (loaded.length === 0) return null;

  // If only 1 image, return it directly (no collage needed)
  if (loaded.length === 1) {
    return null; // caller should use <img> directly
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (style === 'scattered') {
    const bookW = 180, bookH = 250;
    const count = loaded.length;
    const cols = Math.min(colsOpt, count);
    const rows = Math.ceil(count / cols);
    const spacingX = bookW + padding + 30;
    const spacingY = bookH + padding + 30;
    const margin = 60;
    const w = cols * spacingX + margin * 2;
    const h = rows * spacingY + margin * 2;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();

    const rotations = loaded.map((_, i) => {
      const base = [-6, 4, -3, 5, -4, 3, -5, 2, -2, 6, -3.5, 4.5];
      return base[i % base.length] + (Math.random() - 0.5) * 2;
    });
    const offsets = loaded.map(() => ({
      dx: (Math.random() - 0.5) * 16,
      dy: (Math.random() - 0.5) * 12,
    }));

    for (let i = 0; i < loaded.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = margin + col * spacingX + spacingX / 2 + offsets[i].dx;
      const cy = margin + row * spacingY + spacingY / 2 + offsets[i].dy;
      const angle = (rotations[i] * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.shadowColor = 'rgba(0,0,30,0.18)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, -bookW / 2 - 6, -bookH / 2 - 6, bookW + 12, bookH + 12, r + 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.save();
      roundRect(ctx, -bookW / 2, -bookH / 2, bookW, bookH, r);
      ctx.clip();
      const img = loaded[i];
      const scale = Math.max(bookW / img.width, bookH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.restore();
    }
  } else if (style === 'fan') {
    const bookW = 160, bookH = 220;
    const count = loaded.length;
    const totalSpread = Math.min(count * 12, 70);
    const w = Math.max(800, count * 100);
    const h = 500;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();
    const centerX = w / 2;
    const centerY = h + 100;
    for (let i = 0; i < loaded.length; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
      const angle = (t * totalSpread * Math.PI) / 180;
      const radius = 380;
      const cx = centerX + Math.sin(angle) * radius;
      const cy = centerY - Math.cos(angle) * radius;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.shadowColor = 'rgba(0,0,30,0.2)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, -bookW / 2 - 5, -bookH / 2 - 5, bookW + 10, bookH + 10, r + 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      roundRect(ctx, -bookW / 2, -bookH / 2, bookW, bookH, r);
      ctx.clip();
      const img = loaded[i];
      const scale = Math.max(bookW / img.width, bookH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.restore();
    }
  } else {
    // Grid
    const cols = Math.min(colsOpt, loaded.length);
    const rows = Math.ceil(loaded.length / cols);
    const cellW = 240, cellH = 320;
    const w = cols * (cellW + padding) + padding;
    const h = rows * (cellH + padding) + padding;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, 20);
    ctx.fill();
    for (let i = 0; i < loaded.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (cellW + padding);
      const y = padding + row * (cellH + padding);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      roundRect(ctx, x, y, cellW, cellH, r);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      roundRect(ctx, x + 6, y + 6, cellW - 12, cellH - 12, Math.max(0, r - 2));
      ctx.clip();
      const img = loaded[i];
      const scale = Math.max((cellW - 12) / img.width, (cellH - 12) / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, x + 6 + ((cellW - 12) - dw) / 2, y + 6 + ((cellH - 12) - dh) / 2, dw, dh);
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
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
