/**
 * Obrázky a video do e-mailů – v prohlížeči, bez ffmpeg.
 *
 * - screenshot (png/webp/…) → JPG max. 1200 px (Outlook webp nezobrazí, PNG bývá zbytečně těžké)
 * - video → snímek s fialovým tlačítkem play (#7C3AED jako tlačítka v mailu) + délka videa
 * - nahrání do veřejného bucketu `make-93a20b6f-images` (trvalá URL – podepsané URL by v rozeslaném mailu vypršely)
 *
 * Stejný postup pro Claude Code je ve `scripts/newsletter/nahledy.py`.
 */
import { projectId, publicAnonKey } from './supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
export const EMAIL_IMAGE_WIDTH = 1200;
const PLAY_COLOR = '#7C3AED';

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Převod na JPG selhal'))), 'image/jpeg', quality);
  });
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxWidth: number, upscale = false): HTMLCanvasElement {
  const scale = w > maxWidth || upscale ? maxWidth / w : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas není k dispozici');
  // JPG nemá průhlednost – průhledné PNG by jinak zčernalo.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function jpgName(name: string, suffix = ''): string {
  const base = (name || 'obrazek').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'obrazek';
  return `${base}${suffix}.jpg`;
}

/** Obrázek → JPG max. 1200 px. GIF nechá být (animace by se ztratila). */
export async function imageToEmailJpeg(file: File, maxWidth = EMAIL_IMAGE_WIDTH): Promise<File> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = drawScaled(bitmap, bitmap.width, bitmap.height, maxWidth);
    const blob = await canvasToJpeg(canvas);
    return new File([blob], jpgName(file.name), { type: 'image/jpeg' });
  } finally {
    bitmap.close?.();
  }
}

function drawPlayButton(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const r = Math.round(canvas.width * 0.075);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = r * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = PLAY_COLOR;
  ctx.globalAlpha = 0.93;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  const t = r * 0.42;
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.7, cy - t);
  ctx.lineTo(cx - t * 0.7, cy + t);
  ctx.lineTo(cx + t * 1.05, cy);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/**
 * Snímek z videa s tlačítkem play. Bez `atSec` bere 10 % délky (max. 3 s) – úvodní černý snímek bývá prázdný.
 * Vrací i délku videa v sekundách, ať se v mailu píše jen ověřená délka.
 */
export async function videoPosterWithPlay(
  file: File,
  atSec?: number,
): Promise<{ poster: File; durationSec: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video se nepodařilo načíst (podporované je MP4/H.264 nebo WebM)'));
    });
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
    const target = Math.min(atSec ?? Math.min(3, durationSec * 0.1), Math.max(0, durationSec - 0.1));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Snímek z videa se nepodařilo získat'));
      video.currentTime = target;
    });
    // Menší video (např. 720p) zvětšíme na 1200 px, ať je náhled v mailu stejně široký jako ostatní obrázky.
    const canvas = drawScaled(video, video.videoWidth, video.videoHeight, EMAIL_IMAGE_WIDTH, true);
    drawPlayButton(canvas);
    return { poster: new File([await canvasToJpeg(canvas)], jpgName(file.name, '-nahled'), { type: 'image/jpeg' }), durationSec };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Nahraje soubor do veřejného bucketu obrázků webu a vrátí trvalou URL. */
export async function uploadPublicMedia(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${SERVER}/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || `Nahrání selhalo (HTTP ${res.status})`);
  return data.url as string;
}

export function formatVideoDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}
