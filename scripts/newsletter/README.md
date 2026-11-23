# Obrázky a náhledy do newsletteru

Postup, podle kterého vznikají newslettery jako `atlas-zdarma-newsletter-2026-11`.
Stejná pravidla má v systémovém promptu i webový operátor (`/admin/agent`).
Všechno se spouští z kořene repa webu.

**Bez terminálu to jde přímo v adminu:**

- **Webový operátor (`/admin/agent`):** obrázek nebo video stačí přiložit do chatu.
  - Screenshot se sám převede na JPG 1200 px a uloží natrvalo.
  - Z videa vznikne náhled s tlačítkem play a agent dostane jeho adresu, odkaz na video i délku.
- **EmailBuilder:** obrázek vložený do mailu se taky převede na JPG.
- **Kontrola na telefonu:** tlačítko „Náhled na mobilu“ nad testovacím odesláním.

Skript níž dělá totéž z terminálu.

## 1. Screenshoty

Fotí se skutečná aplikace, ne ilustrace. Na konkrétním obrazovkovém stavu záleží:
ukaž to, o čem je odstavec (porodnost a graf HDP, klimadiagram, úkoly).

Screenshoty převeď na JPG široké 1200 px. Outlook neumí webp a PNG bývá zbytečně těžké.

```bash
python3 scripts/newsletter/nahledy.py jpg porodnost.webp teploty.png
```

## 2. Náhled videa s tlačítkem play

Video se do mailu vložit nedá. Do mailu proto jde snímek s fialovým kolečkem play
(barva #7C3AED jako tlačítka) a odkaz na video. Pod obrázek patří šedý popisek
s odkazem, například „Podívejte se na 45sekundové video“. Délku zjisti na souboru:
`ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4`.

```bash
python3 scripts/newsletter/nahledy.py video atlas.mp4 --cas 2
```

`--cas` určuje, ve které sekundě se snímek vezme. Vyber takový, kde je vidět aplikace,
ne prázdný úvod.

## 3. Nahrání

Soubor se nahraje do bucketu `make-93a20b6f-images` a skript vrátí veřejné URL.
Ta jdou do `<img src>`. Agentovi stačí obrázek přiložit do chatu, URL dostane sám.

```bash
python3 scripts/newsletter/nahledy.py nahrat porodnost.jpg atlas-nahled.jpg
```

## 4. Kontrola draftu

Skript vyfotí draft z EmailBuilderu na počítači (700 px) i na mobilu (390 px):

```bash
python3 scripts/newsletter/nahledy.py nahled atlas-zdarma-newsletter-2026-11
```

Na fotkách zkontroluj:

- nic nepřetéká do strany;
- mřížka 2×2 se na mobilu složila pod sebe;
- tlačítka jsou celá vidět;
- podpis je až úplně na konci.

Teprve pak pošli testovací mail z `/mailing`.
