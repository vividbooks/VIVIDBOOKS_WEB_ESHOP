#!/usr/bin/env python3
"""Obrázky a náhledy pro newslettery Vividbooks.

Spouštěj z kořene repa (kvůli anon klíči v src/utils/supabase/info.tsx).

  python3 scripts/newsletter/nahledy.py video  VIDEO.mp4 [--cas 3] [--out nahled.jpg]
      Snímek z videa → 1200 px JPG s fialovým tlačítkem play uprostřed.
  python3 scripts/newsletter/nahledy.py jpg    OBRAZEK.webp|png [...]
      Převod screenshotů na JPG 1200 px (Outlook neumí webp, PNG bývá zbytečně velké).
  python3 scripts/newsletter/nahledy.py nahrat SOUBOR [...]
      POST /upload-image → vypíše veřejné URL (bucket make-93a20b6f-images).
  python3 scripts/newsletter/nahledy.py nahled DRAFT_ID [--out nahled]
      Stáhne draft z EmailBuilderu a vyfotí ho v Chromu: počítač 700 px a mobil 390 px.

Potřebuje: ffmpeg, Pillow, dwebp (brew install webp), Google Chrome.
"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.request, uuid
from pathlib import Path

SB = "https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIRKA = 1200
FIALOVA = (124, 58, 237)  # #7C3AED – stejná barva jako tlačítka v mailu


def anon_key() -> str:
    info = Path("src/utils/supabase/info.tsx")
    if not info.exists():
        sys.exit("Spusť z kořene repa webu (chybí src/utils/supabase/info.tsx).")
    m = re.search(r'publicAnonKey\s*=\s*"([^"]+)"', info.read_text())
    if not m:
        sys.exit("V info.tsx není publicAnonKey.")
    return m.group(1)


def na_jpg(src: Path, out: Path) -> Path:
    from PIL import Image
    tmp = None
    if src.suffix.lower() == ".webp":
        tmp = Path(tempfile.mkstemp(suffix=".png")[1])
        subprocess.run(["dwebp", "-quiet", str(src), "-o", str(tmp)], check=True)
        src = tmp
    im = Image.open(src).convert("RGB")
    if im.width > SIRKA:
        im = im.resize((SIRKA, round(im.height * SIRKA / im.width)), Image.LANCZOS)
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    if tmp:
        tmp.unlink(missing_ok=True)
    return out


def video(args):
    from PIL import Image, ImageDraw
    src = Path(args.soubor)
    out = Path(args.out or src.with_name(src.stem + "-nahled.jpg"))
    frame = Path(tempfile.mkstemp(suffix=".png")[1])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(args.cas), "-i", str(src),
                    "-frames:v", "1", str(frame)], check=True)
    im = Image.open(frame).convert("RGB")
    if im.width != SIRKA:
        im = im.resize((SIRKA, round(im.height * SIRKA / im.width)), Image.LANCZOS)
    # Tlačítko play kreslíme 4× větší a zmenšíme – hladké hrany.
    r = round(im.width * 0.075)
    S = 4
    vrstva = Image.new("RGBA", (2 * r * S, 2 * r * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(vrstva)
    d.ellipse((0, 0, 2 * r * S - 1, 2 * r * S - 1), fill=FIALOVA + (235,), outline=(255, 255, 255, 230), width=3 * S)
    c = r * S
    t = r * S * 0.42
    d.polygon([(c - t * 0.7, c - t), (c - t * 0.7, c + t), (c + t * 1.05, c)], fill=(255, 255, 255, 255))
    vrstva = vrstva.resize((2 * r, 2 * r), Image.LANCZOS)
    im.paste(vrstva, (im.width // 2 - r, im.height // 2 - r), vrstva)
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    frame.unlink(missing_ok=True)
    print(out)


def jpg(args):
    for s in args.soubory:
        src = Path(s)
        print(na_jpg(src, src.with_suffix(".jpg") if src.suffix.lower() != ".jpg" else src.with_name(src.stem + "-1200.jpg")))


def nahrat(args):
    key = anon_key()
    for s in args.soubory:
        p = Path(s)
        ctype = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
                 ".mp4": "video/mp4"}.get(p.suffix.lower(), "application/octet-stream")
        hranice = uuid.uuid4().hex
        telo = (f"--{hranice}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{p.name}\"\r\n"
                f"Content-Type: {ctype}\r\n\r\n").encode() + p.read_bytes() + f"\r\n--{hranice}--\r\n".encode()
        req = urllib.request.Request(f"{SB}/upload-image", data=telo, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={hranice}"})
        with urllib.request.urlopen(req) as r:
            odpoved = json.loads(r.read())
        url = odpoved.get("url") or odpoved.get("publicUrl") or odpoved
        print(f"{p.name}\t{url}")


def nahled(args):
    key = anon_key()
    req = urllib.request.Request(f"{SB}/admin/email-drafts", headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    drafty = data.get("drafts", data) if isinstance(data, dict) else data
    draft = next((d for d in drafty if d.get("id") == args.draft_id), None)
    if not draft:
        sys.exit(f"Draft {args.draft_id} neexistuje.")
    html = Path(tempfile.mkstemp(suffix=".html")[1])
    html.write_text(draft.get("fullHtml") or draft.get("bodyHtml") or "")
    zaklad = args.out or args.draft_id
    # Headless Chrome neumí okno užší než 500 px, takže mobil kreslíme v iframu 390 px a pak ořízneme.
    obal = Path(tempfile.mkstemp(suffix=".html")[1])
    obal.write_text(f'<html><body style="margin:0"><iframe src="file://{html}" '
                    'style="width:390px;height:9000px;border:0;display:block"></iframe></body></html>')
    for jmeno, sirka, stranka in (("pocitac", 700, html), ("mobil", 390, obal)):
        out = Path(f"{zaklad}-{jmeno}.png").resolve()
        out.unlink(missing_ok=True)
        # Vlastní profil, ať se headless Chrome nepere s otevřeným Chromem (jinak končí kódem 2).
        profil = tempfile.mkdtemp(prefix="nahled-chrome-")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={profil}",
                        f"--window-size={max(sirka, 500)},9000", f"--screenshot={out}", f"file://{stranka}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not out.exists():
            sys.exit("Chrome screenshot nevytvořil – zkus zavřít Chrome nebo spustit znovu.")
        if sirka < 500:
            from PIL import Image
            Image.open(out).crop((0, 0, sirka, 9000)).save(out)
        orizni_pozadi(out)
        print(out)
    print(f"Předmět: {draft.get('subject')}\nPreheader: {draft.get('previewText')}")


def orizni_pozadi(png: Path):
    from PIL import Image
    im = Image.open(png).convert("RGB")
    px = im.load()
    w, h = im.size
    y = h - 1
    while y > 0 and all(px[x, y] == px[5, y] for x in range(0, w, 15)):
        y -= 1
    im.crop((0, 0, w, min(h, y + 24))).save(png)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("video"); v.add_argument("soubor"); v.add_argument("--cas", type=float, default=3); v.add_argument("--out"); v.set_defaults(f=video)
    j = sub.add_parser("jpg"); j.add_argument("soubory", nargs="+"); j.set_defaults(f=jpg)
    n = sub.add_parser("nahrat"); n.add_argument("soubory", nargs="+"); n.set_defaults(f=nahrat)
    p = sub.add_parser("nahled"); p.add_argument("draft_id"); p.add_argument("--out"); p.set_defaults(f=nahled)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
