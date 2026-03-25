#!/usr/bin/env python3
"""Vygeneruje public/og-image.png a public/og/categories/*.png (1200×630) pro Open Graph."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "og" / "categories"
W, H = 1200, 630

CATEGORIES: list[tuple[str, str, str]] = [
    ("matematika", "Matematika", "#5533DD"),
    ("fyzika", "Fyzika", "#0099BB"),
    ("chemie", "Chemie", "#E08800"),
    ("prirodopis", "Přírodopis", "#1A9E40"),
    ("cesky-jazyk", "Český jazyk", "#CC1F30"),
    ("prvouka", "Prvouka", "#9933CC"),
    ("anglicky-jazyk", "Anglický jazyk", "#FF4500"),
]

NAVY = "#001161"


def load_fonts() -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, ImageFont.FreeTypeFont | ImageFont.ImageFont]:
    candidates_big = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    candidates_small = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    big = ImageFont.load_default()
    sm = ImageFont.load_default()
    for p in candidates_big:
        if os.path.isfile(p):
            try:
                big = ImageFont.truetype(p, 86)
                break
            except OSError:
                continue
    for p in candidates_small:
        if os.path.isfile(p):
            try:
                sm = ImageFont.truetype(p, 34)
                break
            except OSError:
                continue
    return big, sm


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def draw_card(label: str, accent_hex: str, subtitle: str) -> Image.Image:
    font_big, font_sm = load_fonts()
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    accent = hex_to_rgb(accent_hex)
    # Spodní pruh + jemný „splash“ vpravo nahoře
    draw.rectangle([0, H - 140, W, H], fill=accent_hex)
    for i in range(80):
        alpha = 1.0 - i / 80
        r = int(accent[0] * alpha + 0 * (1 - alpha))
        g = int(accent[1] * alpha + 23 * (1 - alpha))
        b = int(accent[2] * alpha + 97 * (1 - alpha))
        draw.ellipse([W - 380 - i * 3, -120 - i, W + 80 - i * 3, 380 - i], fill=(r, g, b))

    draw.text((64, 160), label, fill="white", font=font_big)
    draw.text((64, H - 100), subtitle, fill="white", font=font_sm)
    draw.text((64, H - 58), "vividbooks.com", fill="#ffffffcc", font=font_sm)
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, label, accent in CATEGORIES:
        im = draw_card(label, accent, "Interaktivní učebnice a pracovní sešity")
        im.save(OUT_DIR / f"{slug}.png", "PNG", optimize=True)
        print("wrote", OUT_DIR / f"{slug}.png")

    home = draw_card("Vividbooks", "#5B4FD8", "Digitální učebnice a tiskoviny pro základní školy")
    home.save(ROOT / "public" / "og-image.png", "PNG", optimize=True)
    print("wrote", ROOT / "public" / "og-image.png")


if __name__ == "__main__":
    main()
