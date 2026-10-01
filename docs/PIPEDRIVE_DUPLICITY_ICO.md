# Duplicity organizací v Pipedrive podle IČO

_Sken 7. 9. 2026 · pole IČO `0f91eb090c567025d50bd189c2fcef7660168cd2` · zdroj: Pipedrive API v2 (`GET /organizations`)_

## Shrnutí

| | |
|---|---:|
| Organizací celkem | 7876 |
| Z toho s vyplněným IČO | 7802 |
| Bez IČO | 74 |
| Duplicitních skupin (1 IČO = 2+ záznamy) | 132 |
| Dotčených organizací | 270 |
| Z toho skupin, kde data (obchody/osoby) má jen 1 záznam | 42 |
| Skupin, kde data má 2+ záznamů → nutné sloučit obsah | 90 |
| Organizací s nesmyslným IČO (0, `0000awda`…) | 21 |

**Normalizace při porovnání:** odstraněny mezery a interpunkce, odříznut prefix `CZ`, doplněny vodicí nuly na 8 číslic. Bez toho by se část duplicit nenašla — např. `82627` vs `00082627`, `00 582 336` vs `00582336`, `CZ25369474` vs `25369474`.

**Sloupce u záznamu:** otevřené / uzavřené obchody, počet napojených osob. Návrh „ponechat" = záznam s nejvíc obchody, při shodě s nejvíc osobami, při shodě nejstarší. Je to jen návrh — sloučení v Pipedrive je nevratné.

## Skupiny

### `49624539` — 3 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2045](https://app.pipedrive.com/organization/2045) | Základní škola a mateřská škola – Nebušická 369, Praha 6 - Nebušice | 2 / 9 | 12 | 2021-03-30 |  |
| sloučit sem | [36011](https://app.pipedrive.com/organization/36011) | Základní škola a mateřská škola, Praha - Nebušice | 0 / 3 | 1 | 2024-10-24 |  |
| sloučit sem | [36323](https://app.pipedrive.com/organization/36323) | ZŠ Nebušice Praha 6 | 0 / 1 | 1 | 2024-10-30 |  |

### `60433230` — 3 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4472](https://app.pipedrive.com/organization/4472) | Základní škola a mateřská škola – Lyčkovo náměstí 460/6, Praha 8 - Karlín | 0 / 10 | 8 | 2021-05-17 |  |
| sloučit sem | [39394](https://app.pipedrive.com/organization/39394) | Základní škola a mateřská škola, Praha 8, Lyčkovo náměstí 6 | 0 / 2 | 2 | 2025-09-02 |  |
| sloučit sem | [25838](https://app.pipedrive.com/organization/25838) | Základní škola a mateřská škola – Lyčkovo náměstí 460/6, Praha 8 - Karlín | 0 / 2 | 1 | 2023-09-07 |  |

### `44226233` — 3 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [36948](https://app.pipedrive.com/organization/36948) | Základní škola a Mateřská škola Ústí nad Labem, SNP 2304/6, příspěvková organizace | 1 / 4 | 4 | 2024-11-15 |  |
| sloučit sem | [4387](https://app.pipedrive.com/organization/4387) | Základní škola a Mateřská škola – SNP 2304/6, Ústí nad Labem | 1 / 3 | 9 | 2021-05-17 |  |
| sloučit sem | [36950](https://app.pipedrive.com/organization/36950) | ZŚ a MŚ Ústí nad Labem, SNP 2304/6 | 0 / 0 | 1 | 2024-11-15 |  |

### `72743735` — 3 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4284](https://app.pipedrive.com/organization/4284) | Základní škola – Kamenická 1145/50, Děčín | 0 / 9 | 5 | 2021-05-17 |  |
| sloučit sem | [36841](https://app.pipedrive.com/organization/36841) | ZŠ Kamenická 1145, Děčín | 0 / 0 | 1 | 2024-11-09 |  |
| sloučit sem | [36842](https://app.pipedrive.com/organization/36842) | ZŠ Kamenická 1145, Děčín II. | 0 / 0 | 1 | 2024-11-09 |  |

### `00216208` — 3 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39761](https://app.pipedrive.com/organization/39761) | Univerzita Karlova | 1 / 1 | 7 | 2026-04-21 |  |
| sloučit sem | [8450](https://app.pipedrive.com/organization/8450) | bb | 0 / 2 | 6 | 2022-10-09 |  |
| sloučit sem | [28554](https://app.pipedrive.com/organization/28554) | Univerzita Karlova | 0 / 2 | 2 | 2024-10-10 |  |

### `Doplň IČO` ⚠️ **neplatné IČO** — 3 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27072](https://app.pipedrive.com/organization/27072) | Doplň správnou organizaci podle IČO | 0 / 0 | 0 | 2024-03-24 |  |
| sloučit sem | [32131](https://app.pipedrive.com/organization/32131) | Doplň správnou organizaci podle IČO | 0 / 0 | 0 | 2024-10-15 |  |
| sloučit sem | [36775](https://app.pipedrive.com/organization/36775) | Doplň správnou organizaci podle IČO | 0 / 0 | 0 | 2024-11-07 |  |

### `29828066` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3483](https://app.pipedrive.com/organization/3483) | Základní škola – nám. Komenského 950, Hluk | 0 / 16 | 7 | 2021-05-17 |  |
| sloučit sem | [39839](https://app.pipedrive.com/organization/39839) | Základní škola a Mateřská škola Hluk, příspěvková organizace | 0 / 1 | 2 | 2026-08-14 |  |

### `70989605` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4707](https://app.pipedrive.com/organization/4707) | Základní škola a Mateřská škola – č.p. 34, Jevišovice | 2 / 15 | 9 | 2021-05-29 |  |
| sloučit sem | [39293](https://app.pipedrive.com/organization/39293) | 709 896 05 | 0 / 0 | 0 | 2025-06-25 | `709 896 05` |

### `61955647` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4383](https://app.pipedrive.com/organization/4383) | Základní škola – Radniční náměstí 1040, Šenov | 2 / 14 | 16 | 2021-05-17 |  |
| sloučit sem | [39742](https://app.pipedrive.com/organization/39742) | Základní škola Šenov, Radniční náměstí 1040, příspěvková organizace | 0 / 0 | 1 | 2026-04-07 |  |

### `25853708` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2608](https://app.pipedrive.com/organization/2608) | Základní škola Sedmikráska, o.p.s. – Bezručova 293, Rožnov pod Radhoštěm | 3 / 12 | 7 | 2021-05-17 |  |
| sloučit sem | [39298](https://app.pipedrive.com/organization/39298) | Základní škola Sedmikráska, o.p.s. | 0 / 0 | 0 | 2025-06-30 |  |

### `47611863` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27932](https://app.pipedrive.com/organization/27932) | Základní škola – Květnového vítězství 1554/54, Praha 4 - Chodov | 2 / 8 | 4 | 2024-08-04 |  |
| sloučit sem | [4557](https://app.pipedrive.com/organization/4557) | Základní škola – Květnového vítězství 1554/54, Praha 4 - Chodov | 0 / 5 | 13 | 2021-05-17 |  |

### `25369474` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [6817](https://app.pipedrive.com/organization/6817) | Základní škola logopedická s.r.o. – Paskovská 65/92, Ostrava | 1 / 13 | 7 | 2021-10-14 |  |
| sloučit sem | [39586](https://app.pipedrive.com/organization/39586) | Základní škola logopedická s.r.o. | 0 / 0 | 1 | 2026-01-05 | `CZ25369474` |

### `62451511` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4381](https://app.pipedrive.com/organization/4381) | Základní škola Dr. Edvarda Beneše – Laurinova 905, Mladá Boleslav | 2 / 9 | 6 | 2021-05-17 |  |
| sloučit sem | [38570](https://app.pipedrive.com/organization/38570) | ZŠ Dr. E. Beneše, Mladá Boleslav | 1 / 2 | 6 | 2025-03-03 |  |

### `70918805` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4479](https://app.pipedrive.com/organization/4479) | ZŠ a MŠ Dr. Edvarda Beneše – náměstí Jiřího Berana 500/1, Praha 9 - Čakovice | 3 / 11 | 19 | 2021-05-17 |  |
| sloučit sem | [39662](https://app.pipedrive.com/organization/39662) | Základní škola a Mateřská škola Dr. Edvarda Beneše, Praha-Čakovice | 0 / 0 | 0 | 2026-02-09 |  |

### `62209485` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2706](https://app.pipedrive.com/organization/2706) | Základní škola profesora Zdeňka Matějčka – Zdeňka Štěpánka 340, Most | 0 / 11 | 4 | 2021-05-17 |  |
| sloučit sem | [37623](https://app.pipedrive.com/organization/37623) | ZŠ prof. Z. Matějčka Most | 0 / 2 | 2 | 2025-01-09 |  |

### `65142799` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2042](https://app.pipedrive.com/organization/2042) | Gymnázium Prigo | 3 / 9 | 12 | 2021-03-30 |  |
| sloučit sem | [8424](https://app.pipedrive.com/organization/8424) | Lék. a přír. GYMNÁZIUM PRIGO, s.r.o. | 0 / 1 | 9 | 2022-10-04 |  |

### `63831392` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4023](https://app.pipedrive.com/organization/4023) | Základní škola – náměstí Jiřího z Poděbrad 1685/7, Praha 3 - Vinohrady | 1 / 9 | 34 | 2021-05-17 |  |
| sloučit sem | [28558](https://app.pipedrive.com/organization/28558) | Základní škola – náměstí Jiřího z Poděbrad 1685/7, Praha 3 - Vinohrady | 0 / 2 | 2 | 2024-10-10 |  |

### `03972071` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2961](https://app.pipedrive.com/organization/2961) | LABYRINTH - gymnázium a ZŠ, s.r.o. – Lidická 1869/28, Brno | 0 / 11 | 7 | 2021-05-17 |  |
| sloučit sem | [39292](https://app.pipedrive.com/organization/39292) | LABYRINTH - gymnázium a základní škola, s.r.o. | 0 / 0 | 0 | 2025-06-23 |  |

### `07699603` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [25619](https://app.pipedrive.com/organization/25619) | ZŠ Eduard | 1 / 10 | 3 | 2023-05-26 |  |
| sloučit sem | [34885](https://app.pipedrive.com/organization/34885) | Základní škola Eduard – Ernsta Macha 866/27d, Brno | 0 / 0 | 0 | 2024-10-23 |  |

### `28431634` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2465](https://app.pipedrive.com/organization/2465) | Victoria School, s.r.o., ZŠ a MŠ – Oplanská 2339, Praha 9 - Újezd nad Lesy | 0 / 6 | 1 | 2021-05-17 |  |
| sloučit sem | [24960](https://app.pipedrive.com/organization/24960) | Victoria School, s.r.o., ZŠ a MŠ – Oplanská 2339, Praha 9 - Újezd nad Lesy | 1 / 4 | 4 | 2023-04-28 |  |

### `46773614` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4262](https://app.pipedrive.com/organization/4262) | Základní škola – Karla Jeřábka 941, Roudnice nad Labem | 0 / 8 | 9 | 2021-05-17 |  |
| sloučit sem | [36714](https://app.pipedrive.com/organization/36714) | Základní škola Roudnice nad Labem, Karla Jeřábka 941, okres Litoměřice | 0 / 3 | 6 | 2024-11-07 |  |

### `62331540` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2057](https://app.pipedrive.com/organization/2057) | Gymnázium Orlová | 2 / 9 | 9 | 2021-03-30 |  |
| sloučit sem | [39709](https://app.pipedrive.com/organization/39709) | Gymnázium a Obchodní akademie, Orlová, příspěvková organizace | 0 / 0 | 0 | 2026-02-24 |  |

### `25612778` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2110](https://app.pipedrive.com/organization/2110) | Základní škola Klíček – Donovalská 1863/44, Praha 4 - Chodov | 0 / 9 | 3 | 2021-04-09 |  |
| sloučit sem | [39228](https://app.pipedrive.com/organization/39228) | Základní škola Klíček | 0 / 1 | 2 | 2025-05-06 |  |

### `48133833` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4394](https://app.pipedrive.com/organization/4394) | Základní škola a Mateřská škola – Bílá 1784/1, Praha 6 - Dejvice | 0 / 10 | 5 | 2021-05-17 |  |
| sloučit sem | [27558](https://app.pipedrive.com/organization/27558) | Základní škola a Mateřská škola – Bílá 1784/1, Praha 6 - Dejvice | 0 / 0 | 2 | 2024-05-20 |  |

### `25088246` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [5062](https://app.pipedrive.com/organization/5062) | Pražské humanitní gymnázium | 0 / 6 | 5 | 2021-07-16 |  |
| sloučit sem | [28202](https://app.pipedrive.com/organization/28202) | PHG | 0 / 3 | 2 | 2024-09-02 |  |

### `43256791` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [6835](https://app.pipedrive.com/organization/6835) | ZŠ Tanvald, příspěvková organizace – Školní 416, Tanvald | 0 / 5 | 5 | 2021-10-18 |  |
| sloučit sem | [37941](https://app.pipedrive.com/organization/37941) | Masarykova základní škola Tanvald, příspěvková organizace | 1 / 3 | 1 | 2025-01-29 |  |

### `45238782` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3855](https://app.pipedrive.com/organization/3855) | Základní škola – Jungmannova 655/2, Litovel | 3 / 6 | 11 | 2021-05-17 |  |
| sloučit sem | [39739](https://app.pipedrive.com/organization/39739) | Základní škola Litovel, Jungmannova 655, okres Olomouc | 0 / 0 | 1 | 2026-04-07 | `CZ45238782` |

### `47611928` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3717](https://app.pipedrive.com/organization/3717) | Základní škola a mateřská škola – Na Smetance 505/1, Praha 2 - Vinohrady | 1 / 8 | 3 | 2021-05-17 |  |
| sloučit sem | [39961](https://app.pipedrive.com/organization/39961) | ZŠ a MŠ, Praha 2, Na Smetance 1 | 0 / 0 | 1 | 2026-09-01 |  |

### `69781761` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3776](https://app.pipedrive.com/organization/3776) | Základní škola – Nepomucká 139/1, Praha 5 - Košíře | 1 / 8 | 12 | 2021-05-17 |  |
| sloučit sem | [39431](https://app.pipedrive.com/organization/39431) | Základní škola Praha 5 - Košíře, Nepomucká 1/139, příspěvková organizace | 0 / 0 | 0 | 2025-09-12 |  |

### `71341269` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [36973](https://app.pipedrive.com/organization/36973) | NOE - Křesťanská základní škola a mateřská škola v Pardubicích | 1 / 6 | 4 | 2024-11-17 |  |
| sloučit sem | [2736](https://app.pipedrive.com/organization/2736) | NOE - Křesťanská ZŠ a MŠ v Pardubicích – Lonkova 512, Pardubice | 0 / 2 | 2 | 2021-05-17 |  |

### `75033119` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2796](https://app.pipedrive.com/organization/2796) | Základní škola a Mateřská škola – VI. ulice 165, Vinařice | 2 / 6 | 5 | 2021-05-17 |  |
| sloučit sem | [24672](https://app.pipedrive.com/organization/24672) | ZŠ a MŠ Vinařice, okres Kladno | 0 / 1 | 1 | 2023-04-26 | `750 33 119` |

### `47723505` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4441](https://app.pipedrive.com/organization/4441) | Základní škola JIH – Komenského 459/1, Mariánské Lázně | 1 / 7 | 7 | 2021-05-17 |  |
| sloučit sem | [39646](https://app.pipedrive.com/organization/39646) | Základní škola JIH, Mariánské Lázně, Komenského 459, příspěvková organizace | 0 / 0 | 0 | 2026-02-06 |  |

### `60435674` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4238](https://app.pipedrive.com/organization/4238) | Základní škola a Mateřská škola – Ohradní 1366/49, Praha 4 - Michle | 0 / 7 | 5 | 2021-05-17 |  |
| sloučit sem | [39275](https://app.pipedrive.com/organization/39275) | Základní škola a Mateřská škola, Praha 4, Ohradní 49 | 0 / 1 | 1 | 2025-06-02 |  |

### `68407122` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4135](https://app.pipedrive.com/organization/4135) | Základní škola a Mateřská škola – Na dlouhém lánu 555/43, Praha 6 - Vokovice | 1 / 7 | 7 | 2021-05-17 |  |
| sloučit sem | [39677](https://app.pipedrive.com/organization/39677) | Základní škola a Mateřská škola, Praha 6, Na Dlouhém lánu 43 | 0 / 0 | 3 | 2026-02-12 |  |

### `70994994` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3946](https://app.pipedrive.com/organization/3946) | Základní škola – Palackého 278, Bakov nad Jizerou | 1 / 7 | 8 | 2021-05-17 |  |
| sloučit sem | [39720](https://app.pipedrive.com/organization/39720) | Základní škola Bakov nad Jizerou,okres Mladá BoleslaV | 0 / 0 | 0 | 2026-03-03 |  |

### `71340858` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27764](https://app.pipedrive.com/organization/27764) | Soukromá MŠ a ZŠ Petrklíč – náměstí Osvoboditelů 1368/27, Praha 5 - Radotín | 0 / 8 | 3 | 2024-06-07 |  |
| sloučit sem | [28459](https://app.pipedrive.com/organization/28459) | Soukromá MŠ a ZŠ Petrklíč – náměstí Osvoboditelů 1368/27, Praha 5 - Radotín | 0 / 0 | 1 | 2024-10-07 |  |

### `71341439` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27527](https://app.pipedrive.com/organization/27527) | MŠ a ZŠ Slunečnice – č.p. 113, Okrouhlice | 2 / 5 | 3 | 2024-05-16 |  |
| sloučit sem | [36544](https://app.pipedrive.com/organization/36544) | MŠ a ZŠ Slunečnice – č.p. 113, Okrouhlice | 0 / 1 | 1 | 2024-11-03 |  |

### `05007984` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [7906](https://app.pipedrive.com/organization/7906) | ZŠ Na Radosti | 0 / 4 | 1 | 2022-05-04 | `05 007 984` |
| sloučit sem | [35472](https://app.pipedrive.com/organization/35472) | Základní škola Na Radosti – Husova 376/3, Žďár nad Sázavou | 1 / 2 | 2 | 2024-10-23 |  |

### `21287848` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [8637](https://app.pipedrive.com/organization/8637) | Základní škola Hučák – č.p. 83, Lochenice | 0 / 7 | 6 | 2022-11-24 |  |
| sloučit sem | [39682](https://app.pipedrive.com/organization/39682) | ScioŠkola Hradec Králové - základní škola, s.r.o. | 0 / 0 | 0 | 2026-02-13 |  |

### `25349520` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2486](https://app.pipedrive.com/organization/2486) | Academic School, MŠ, ZŠ a SŠ, s.r.o. – Studentské náměstí 1531, Uherské Hradiště | 0 / 7 | 7 | 2021-05-17 |  |
| sloučit sem | [39713](https://app.pipedrive.com/organization/39713) | Academic School, Mateřská škola, základní škola a střední škola, s.r.o. | 0 / 0 | 1 | 2026-02-26 |  |

### `42727537` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4392](https://app.pipedrive.com/organization/4392) | Základní škola – náměstí Komenského 35, Dobříš | 2 / 5 | 14 | 2021-05-17 |  |
| sloučit sem | [39726](https://app.pipedrive.com/organization/39726) | Základní škola Dobříš, Komenského nám. 35, okres Příbram | 0 / 0 | 0 | 2026-03-18 |  |

### `44991665` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4814](https://app.pipedrive.com/organization/4814) | AKADEMIA Gy, ZŠ a MŠ, s.r.o. – Rašelinová 2433/11, Brno | 1 / 6 | 9 | 2021-07-16 |  |
| sloučit sem | [39723](https://app.pipedrive.com/organization/39723) | AKADEMIA Gymnázium, Základní škola a Mateřská škola, s.r.o. | 0 / 0 | 0 | 2026-03-07 |  |

### `48895512` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [37775](https://app.pipedrive.com/organization/37775) | Gymnazium Vincence Makovskeho NMNM | 2 / 4 | 1 | 2025-01-22 |  |
| sloučit sem | [5015](https://app.pipedrive.com/organization/5015) | Gymnázium V.Makovského se sport. třídami | 0 / 1 | 3 | 2021-07-16 |  |

### `63834341` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4181](https://app.pipedrive.com/organization/4181) | Základní škola Marjánka – Bělohorská 417/52, Praha 6 - Břevnov | 1 / 6 | 8 | 2021-05-17 |  |
| sloučit sem | [37735](https://app.pipedrive.com/organization/37735) | Základní škola Marjánka, Praha 6, Bělohorská 52 | 0 / 0 | 1 | 2025-01-17 |  |

### `70877441` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2611](https://app.pipedrive.com/organization/2611) | ZŠ Hany Benešové a MŠ – Dolní Bory 161, Bory | 0 / 6 | 6 | 2021-05-17 |  |
| sloučit sem | [39582](https://app.pipedrive.com/organization/39582) | Základní škola Hany Benešové a Mateřská škola Bory, příspěvková organizace | 0 / 1 | 1 | 2025-12-23 |  |

### `72744430` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27419](https://app.pipedrive.com/organization/27419) | Základní škola, příspěvková organizace – U nemocnice 1132/5, Rumburk | 1 / 3 | 2 | 2024-05-02 |  |
| sloučit sem | [4152](https://app.pipedrive.com/organization/4152) | Základní škola, příspěvková organizace – U nemocnice 1132/5, Rumburk | 0 / 3 | 3 | 2021-05-17 |  |

### `49156608` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3913](https://app.pipedrive.com/organization/3913) | Základní škola – Školní 666, Luhačovice | 0 / 6 | 11 | 2021-05-17 |  |
| sloučit sem | [39401](https://app.pipedrive.com/organization/39401) | Základní škola Luhačovice, příspěvková organizace | 0 / 0 | 3 | 2025-09-05 |  |

### `61386898` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4168](https://app.pipedrive.com/organization/4168) | Základní škola – Dygrýnova 1006/21, Praha 9 - Černý Most | 0 / 5 | 2 | 2021-05-17 |  |
| sloučit sem | [39252](https://app.pipedrive.com/organization/39252) | Základní škola Generála Janouška, Praha 9 - Černý Most, Dygrýnova 1006/21 | 0 / 1 | 1 | 2025-05-21 |  |

### `61924041` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4930](https://app.pipedrive.com/organization/4930) | Gymnázium a Střední odborná škola pedagogická, Čáslav, Masarykova 248 | 1 / 5 | 10 | 2021-07-16 |  |
| sloučit sem | [39560](https://app.pipedrive.com/organization/39560) | 619 240 41 | 0 / 0 | 0 | 2025-11-18 | `619 240 41` |

### `62073184` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3130](https://app.pipedrive.com/organization/3130) | Základní škola – č.p. 283, Lipůvka | 1 / 5 | 10 | 2021-05-17 |  |
| sloučit sem | [39708](https://app.pipedrive.com/organization/39708) | Základní škola Lipůvka, příspěvková organizace | 0 / 0 | 0 | 2026-02-24 |  |

### `70641871` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2862](https://app.pipedrive.com/organization/2862) | Základní škola a mateřská škola – Bílovecká 10/7, Ostrava | 1 / 5 | 4 | 2021-05-17 |  |
| sloučit sem | [39679](https://app.pipedrive.com/organization/39679) | Základní škola a mateřská škola Ostrava-Svinov, příspěvková organizace | 0 / 0 | 0 | 2026-02-13 |  |

### `70987700` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [35656](https://app.pipedrive.com/organization/35656) | Základní škola – Vrchlického 401/5, Ostrava | 1 / 2 | 3 | 2024-10-23 |  |
| sloučit sem | [37190](https://app.pipedrive.com/organization/37190) | Základní škola Ostrava-Radvanice, Vrchlického 5, příspěvková organizace | 0 / 3 | 2 | 2024-12-02 |  |

### `71012117` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3163](https://app.pipedrive.com/organization/3163) | Základní škola a mateřská škola – Paříkovo nám. 133, Třebenice | 0 / 4 | 3 | 2021-05-17 |  |
| sloučit sem | [36061](https://app.pipedrive.com/organization/36061) | Základní škola a mateřská škola – Paříkovo nám. 133, Třebenice | 0 / 2 | 2 | 2024-10-24 |  |

### `75018691` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3223](https://app.pipedrive.com/organization/3223) | Základní škola – Pulická 378, Dobruška | 0 / 6 | 3 | 2021-05-17 |  |
| sloučit sem | [28366](https://app.pipedrive.com/organization/28366) | Základní škola – Pulická 378, Dobruška | 0 / 0 | 3 | 2024-09-23 |  |

### `75029901` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3185](https://app.pipedrive.com/organization/3185) | Základní škola a mateřská škola – č.p. 750, Mosty u Jablunkova | 0 / 6 | 11 | 2021-05-17 |  |
| sloučit sem | [39648](https://app.pipedrive.com/organization/39648) | Základní škola a mateřská škola Mosty u Jablunkova 750,  příspěvková organizace | 0 / 0 | 0 | 2026-02-06 |  |

### `00582841` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4052](https://app.pipedrive.com/organization/4052) | Základní škola Soběslav, tř. Dr. Edvarda Beneše 50 | 0 / 3 | 3 | 2021-05-17 | `582841` |
| sloučit sem | [26367](https://app.pipedrive.com/organization/26367) | Základní škola – tř. Dr. Edvarda Beneše 50/18, Soběslav | 0 / 2 | 2 | 2023-11-29 |  |

### `00830984` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4148](https://app.pipedrive.com/organization/4148) | Základní škola – Obránců míru 2944/1, Most | 1 / 4 | 4 | 2021-05-17 |  |
| sloučit sem | [39841](https://app.pipedrive.com/organization/39841) | ZŠ Obránců míru 2944, Most | 0 / 0 | 1 | 2026-08-16 | `830984` |

### `25546210` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39377](https://app.pipedrive.com/organization/39377) | PORG Brno - gymnázium, základní škola a mateřská škola, o.p.s. | 0 / 3 | 5 | 2025-08-28 |  |
| sloučit sem | [5038](https://app.pipedrive.com/organization/5038) | I. Něm. zem. gymnasium, ZŠ a MŠ, o.p.s. – Mendlovo náměstí 1/4, Brno | 0 / 2 | 4 | 2021-07-16 |  |

### `25602578` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [38882](https://app.pipedrive.com/organization/38882) | Soukromá základní škola Integrál pro žáky se specifickými poruchami učení, s.r.o. | 0 / 4 | 2 | 2025-03-17 |  |
| sloučit sem | [2349](https://app.pipedrive.com/organization/2349) | Soukr. ZŠ Integrál pro žáky se spec.por. – Jana Masaryka 360/25, Praha 2 - Vinohrady | 0 / 1 | 1 | 2021-05-17 |  |

### `28895410` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2841](https://app.pipedrive.com/organization/2841) | Základní škola Wonderland Academy s.r.o. – U Školky 880, Praha 4 - Šeberov | 0 / 5 | 3 | 2021-05-17 |  |
| sloučit sem | [39588](https://app.pipedrive.com/organization/39588) | Základní škola Wonderland Academy s.r.o. | 0 / 0 | 1 | 2026-01-07 |  |

### `47657022` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4562](https://app.pipedrive.com/organization/4562) | Základní škola – Heyrovského 460/33, Olomouc | 1 / 4 | 19 | 2021-05-17 |  |
| sloučit sem | [39706](https://app.pipedrive.com/organization/39706) | Základní škola Olomouc, Heyrovského 33, příspěvková organizace | 0 / 0 | 0 | 2026-02-24 |  |

### `49777513` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [26638](https://app.pipedrive.com/organization/26638) | ZČU v Plzni | 0 / 3 | 3 | 2024-02-26 |  |
| sloučit sem | [39564](https://app.pipedrive.com/organization/39564) | Západočeská univerzita v Plzni Univerzitní knihovna | 1 / 1 | 1 | 2025-11-28 | `: 49777513` |

### `65765907` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3201](https://app.pipedrive.com/organization/3201) | Základní škola a mateřská škola – Komenského 324/4, Adamov | 0 / 5 | 6 | 2021-05-17 |  |
| sloučit sem | [39243](https://app.pipedrive.com/organization/39243) | Základní škola a mateřská škola Adamov, příspěvková organizace | 0 / 0 | 0 | 2025-05-16 |  |

### `69781877` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4343](https://app.pipedrive.com/organization/4343) | Základní škola a mateřská škola – Weberova 1090/1, Praha 5 - Košíře | 0 / 5 | 7 | 2021-05-17 |  |
| sloučit sem | [39651](https://app.pipedrive.com/organization/39651) | 697 818 77 | 0 / 0 | 0 | 2026-02-07 | `697 818 77` |

### `70944687` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4251](https://app.pipedrive.com/organization/4251) | Základní škola a mateřská škola – Kosmonautů 2217/15, Ostrava | 0 / 5 | 6 | 2021-05-17 |  |
| sloučit sem | [39694](https://app.pipedrive.com/organization/39694) | Základní škola a mateřská škola Ostrava-Zábřeh, Kosmonautů, příspěvková organizace | 0 / 0 | 0 | 2026-02-18 |  |

### `71001514` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4504](https://app.pipedrive.com/organization/4504) | Základní škola – Tyršova 611, Židlochovice | 0 / 3 | 9 | 2021-05-17 |  |
| sloučit sem | [36271](https://app.pipedrive.com/organization/36271) | Základní škola Židlochovice, okres Brno-venkov, příspěvková organizace | 1 / 1 | 11 | 2024-10-28 |  |

### `04775112` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [8313](https://app.pipedrive.com/organization/8313) | 2. ScioŠkola Praha - základní škola, s.r.o | 0 / 3 | 0 | 2022-09-02 | `4775112` |
| sloučit sem | [28321](https://app.pipedrive.com/organization/28321) | 2. ScioŠkola Praha - ZŠ, s.r.o. – V zahrádkách 2833/3, Praha 3 - Žižkov | 0 / 1 | 1 | 2024-09-12 |  |

### `46773592` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4199](https://app.pipedrive.com/organization/4199) | Základní škola a mateřská škola – Školní 1803, Roudnice nad Labem | 1 / 2 | 5 | 2021-05-17 |  |
| sloučit sem | [39581](https://app.pipedrive.com/organization/39581) | Základní škola a mateřská škola Roudnice nad Labem, Školní 1803 | 0 / 1 | 1 | 2025-12-18 |  |

### `46773703` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2533](https://app.pipedrive.com/organization/2533) | Základní škola a Mateřská škola – č.p. 170, Velemín | 0 / 3 | 3 | 2021-05-17 |  |
| sloučit sem | [32109](https://app.pipedrive.com/organization/32109) | Základní škola a Mateřská škola – č.p. 170, Velemín | 0 / 1 | 4 | 2024-10-14 |  |

### `47324180` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4002](https://app.pipedrive.com/organization/4002) | Základní škola – J. A. Komenského 474/22, Most | 0 / 3 | 3 | 2021-05-17 |  |
| sloučit sem | [39755](https://app.pipedrive.com/organization/39755) | Základní škola, Most, J. A. Komenského 474, příspěvková organizace | 0 / 1 | 1 | 2026-04-15 |  |

### `47443936` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2283](https://app.pipedrive.com/organization/2283) | Základní škola – Cyrilometodějská 42/22, Třebíč | 1 / 2 | 2 | 2021-05-17 |  |
| sloučit sem | [39225](https://app.pipedrive.com/organization/39225) | Základní škola Třebíč, Cyrilometodějská 22 | 0 / 1 | 1 | 2025-05-04 |  |

### `49123866` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [28374](https://app.pipedrive.com/organization/28374) | ZŠ a MŠ Kpt. Otakara Jaroše – 28. října 2173, Louny | 0 / 2 | 3 | 2024-09-24 |  |
| sloučit sem | [4230](https://app.pipedrive.com/organization/4230) | ZŠ a MŠ Kpt. Otakara Jaroše – 28. října 2173, Louny | 0 / 2 | 2 | 2021-05-17 |  |

### `61357332` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4031](https://app.pipedrive.com/organization/4031) | Základní škola – Jižní 2777, Žatec | 0 / 3 | 1 | 2021-05-17 |  |
| sloučit sem | [36543](https://app.pipedrive.com/organization/36543) | Základní škola Žatec, Jižní 2777, 43801 Žatec, okr. Louny | 0 / 1 | 0 | 2024-11-03 |  |

### `61388149` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2705](https://app.pipedrive.com/organization/2705) | Gymn., SOŠ, ZŠ a MŠ pro sluch. postižené – Ječná 530/27, Praha 2 - Nové Město | 0 / 3 | 4 | 2021-05-17 |  |
| sloučit sem | [7188](https://app.pipedrive.com/organization/7188) | Gymnázium,SOŠ,ZŠ a MŠ pro sluchově postižené | 0 / 1 | 0 | 2021-12-08 |  |

### `62858939` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3710](https://app.pipedrive.com/organization/3710) | Základní škola a mateřská škola – Sportovní 850, Kostelec na Hané | 0 / 4 | 4 | 2021-05-17 |  |
| sloučit sem | [39429](https://app.pipedrive.com/organization/39429) | Základní škola a mateřská škola Kostelec na Hané, okres Prostějov, příspěvková organizace | 0 / 0 | 1 | 2025-09-12 |  |

### `63831325` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3011](https://app.pipedrive.com/organization/3011) | Základní škola – Cimburkova 600/18, Praha 3 - Žižkov | 0 / 4 | 2 | 2021-05-17 |  |
| sloučit sem | [28264](https://app.pipedrive.com/organization/28264) | Základní škola – Cimburkova 600/18, Praha 3 - Žižkov | 0 / 0 | 1 | 2024-09-05 |  |

### `68729928` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2873](https://app.pipedrive.com/organization/2873) | Základní škola a Mateřská škola – Masarykova 178, Vranovice | 0 / 4 | 7 | 2021-05-17 |  |
| sloučit sem | [39206](https://app.pipedrive.com/organization/39206) | Základní škola a Mateřská škola Vranovice, příspěvková organizace | 0 / 0 | 0 | 2025-04-25 |  |

### `70695521` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [6739](https://app.pipedrive.com/organization/6739) | Základní škola a Mateřská škola – č.p. 236, Čistá u Horek | 1 / 2 | 1 | 2021-09-27 |  |
| sloučit sem | [39837](https://app.pipedrive.com/organization/39837) | Základní škola a Mateřská škola Čistá u Horek p.o. | 1 / 0 | 2 | 2026-08-05 |  |

### `70879010` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3426](https://app.pipedrive.com/organization/3426) | Základní škola T. G. Masaryka – Husova 445, Podbořany | 0 / 3 | 5 | 2021-05-17 |  |
| sloučit sem | [36772](https://app.pipedrive.com/organization/36772) | ZŠ TGM Husova 445,Podborany | 0 / 1 | 1 | 2024-11-07 |  |

### `71341340` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2808](https://app.pipedrive.com/organization/2808) | MŠ, ZŠ a gymnázium sv. Augustina – Hornokrčská 709/3, Praha 4 - Krč | 0 / 4 | 2 | 2021-05-17 |  |
| sloučit sem | [36938](https://app.pipedrive.com/organization/36938) | MŠ, ZŠ a gymnázium sv. Augustina | 0 / 0 | 1 | 2024-11-14 |  |

### `75003759` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [7874](https://app.pipedrive.com/organization/7874) | Základní škola a mateřská škola – Šafránka 54, Rozdrojovice | 0 / 4 | 4 | 2022-04-26 |  |
| sloučit sem | [39418](https://app.pipedrive.com/organization/39418) | Základní škola a mateřská škola Rozdrojovice, okr. Brno - venkov, příspěvková organizace | 0 / 0 | 0 | 2025-09-09 |  |

### `75016346` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2777](https://app.pipedrive.com/organization/2777) | Základní škola – Komenského nám. 150, Skuteč | 0 / 4 | 5 | 2021-05-17 |  |
| sloučit sem | [39707](https://app.pipedrive.com/organization/39707) | Základní škola, Skuteč, Komenského 150, okres Chrudim | 0 / 0 | 0 | 2026-02-24 |  |

### `75029448` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2699](https://app.pipedrive.com/organization/2699) | Základní škola – Hrdinů 249, Vidnava | 0 / 4 | 3 | 2021-05-17 |  |
| sloučit sem | [39205](https://app.pipedrive.com/organization/39205) | Základní škola Vidnava, okres Jeseník - příspěvková organizace | 0 / 0 | 0 | 2025-04-25 |  |

### `00082627` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2842](https://app.pipedrive.com/organization/2842) | Střední škola obchodu, řemesel, služeb a Základní škola, Ústí nad Labem, příspěvková organizace | 0 / 2 | 3 | 2021-05-17 | `82627` |
| sloučit sem | [9040](https://app.pipedrive.com/organization/9040) | SŠ obchodu, řemesel, služeb a ZŠ – Keplerova 315/7, Ústí nad Labem | 1 / 0 | 1 | 2023-01-17 |  |

### `00873489` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [9482](https://app.pipedrive.com/organization/9482) | OU, PrŠ, ZŠ a MŠ – Pod Šachtami 335, Příbram | 1 / 1 | 4 | 2023-01-17 |  |
| sloučit sem | [2320](https://app.pipedrive.com/organization/2320) | Odborné učiliště, Praktická škola, Základní škola a Mateřská škola Příbram IV, příspěvková organizace | 0 / 1 | 1 | 2021-05-17 | `873489` |

### `06069185` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39428](https://app.pipedrive.com/organization/39428) | Základní škola Ninjabot | 1 / 1 | 9 | 2025-09-12 | `6069185` |
| sloučit sem | [39835](https://app.pipedrive.com/organization/39835) | Ninjabot | 1 / 0 | 1 | 2026-08-01 |  |

### `24252832` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [34680](https://app.pipedrive.com/organization/34680) | MŠ a ZŠ Duhový svět, s.r.o. – Bendlova 2168, Kladno | 1 / 2 | 2 | 2024-10-23 |  |
| sloučit sem | [7884](https://app.pipedrive.com/organization/7884) | MŠ a ZŠ Duhový Svět, s.r.o. | 0 / 0 | 1 | 2022-04-27 | `242 52 832` |

### `25741497` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [5083](https://app.pipedrive.com/organization/5083) | ZŠ něm.-čes. por. T.Manna, o.p.s. – Střížkovská 32/27, Praha 8 - Střížkov | 1 / 1 | 3 | 2021-07-16 |  |
| sloučit sem | [39383](https://app.pipedrive.com/organization/39383) | Základní škola německo-českého porozumění Thomase Manna, o.p.s. | 0 / 1 | 1 | 2025-08-29 |  |

### `46747885` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39525](https://app.pipedrive.com/organization/39525) | Fakulta přírodovědně-humanitní a pedagogická Univerzitní náměstí 1410/1 (budova G) Liberec 460 01 Česká republika | 0 / 2 | 1 | 2025-10-21 |  |
| sloučit sem | [38100](https://app.pipedrive.com/organization/38100) | Technická univerzita Liberec | 0 / 1 | 1 | 2025-02-04 |  |

### `48132926` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3944](https://app.pipedrive.com/organization/3944) | Základní škola – Sázavská 830/5, Praha 2 - Vinohrady | 0 / 3 | 2 | 2021-05-17 |  |
| sloučit sem | [36795](https://app.pipedrive.com/organization/36795) | ZŠ Sázavská, Praha 2, Sázavská 5 | 0 / 0 | 2 | 2024-11-07 |  |

### `48512702` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [35668](https://app.pipedrive.com/organization/35668) | Základní škola a mateřská škola – náměstí 28. října 1902/22, Brno | 1 / 2 | 4 | 2024-10-23 |  |
| sloučit sem | [39528](https://app.pipedrive.com/organization/39528) | Základní škola a mateřská škola Brno, nám. 28. října 22, příspěvková organizace | 0 / 0 | 0 | 2025-10-23 |  |

### `49438816` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4834](https://app.pipedrive.com/organization/4834) | Gy, SPgŠ, OA a JŠ s právem státní JZ | 0 / 3 | 3 | 2021-07-16 |  |
| sloučit sem | [39976](https://app.pipedrive.com/organization/39976) | Základní organizace GPOA Znojmo | 0 / 0 | 0 | 2026-09-05 |  |

### `60545984` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4983](https://app.pipedrive.com/organization/4983) | Gymnázium Jihlava | 1 / 1 | 5 | 2021-07-16 |  |
| sloučit sem | [39396](https://app.pipedrive.com/organization/39396) | Gymnázium Jihlava | 0 / 1 | 0 | 2025-09-04 |  |

### `61357324` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2461](https://app.pipedrive.com/organization/2461) | Základní škola a Mateřská škola – č.p. 182, Krásný Dvůr | 0 / 3 | 3 | 2021-05-17 |  |
| sloučit sem | [28491](https://app.pipedrive.com/organization/28491) | Základní škola a Mateřská škola – č.p. 182, Krásný Dvůr | 0 / 0 | 1 | 2024-10-09 |  |

### `61388254` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3936](https://app.pipedrive.com/organization/3936) | Základní škola – Písnická 760/11, Praha 4 - Kamýk | 0 / 2 | 2 | 2021-05-17 |  |
| sloučit sem | [36203](https://app.pipedrive.com/organization/36203) | Základní škola Písnická v Praze 12 | 0 / 1 | 2 | 2024-10-27 |  |

### `62331205` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [32237](https://app.pipedrive.com/organization/32237) | Gymnazium Františka Živného Bohumín | 0 / 2 | 2 | 2024-10-21 |  |
| sloučit sem | [4956](https://app.pipedrive.com/organization/4956) | Gymnázium Fr.Živného | 0 / 1 | 1 | 2021-07-16 |  |

### `68379919` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2457](https://app.pipedrive.com/organization/2457) | ZŠ pro žáky se specif. poruchami učení – U boroviček 649/3, Praha 6 - Řepy | 0 / 3 | 1 | 2021-05-17 |  |
| sloučit sem | [36961](https://app.pipedrive.com/organization/36961) | ZŠ pro žáky s SPU | 0 / 0 | 1 | 2024-11-15 |  |

### `72744413` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [26145](https://app.pipedrive.com/organization/26145) | Základní škola – Komenského 218, Hrob | 0 / 2 | 4 | 2023-11-08 |  |
| sloučit sem | [28261](https://app.pipedrive.com/organization/28261) | Základní škola – Komenského 218, Hrob | 0 / 1 | 0 | 2024-09-05 |  |

### `72745096` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2449](https://app.pipedrive.com/organization/2449) | Masarykova ZŠ a MŠ – č.p. 126, Žalhostice | 1 / 2 | 3 | 2021-05-17 |  |
| sloučit sem | [37670](https://app.pipedrive.com/organization/37670) | Masarykova základní škola a mateřská škola Žalhostice, okres Litoměřice, příspěvková organizace | 0 / 0 | 2 | 2025-01-12 |  |

### `00009999` ⚠️ **neplatné IČO** — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [7843](https://app.pipedrive.com/organization/7843) | ZS Myjava | 0 / 1 | 1 | 2022-04-24 | `9999` |
| sloučit sem | [39760](https://app.pipedrive.com/organization/39760) | Ninjabot | 1 / 0 | 1 | 2026-04-20 | `9999` |

### `00638765` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [9267](https://app.pipedrive.com/organization/9267) | Střední zdravotnická škola | 0 / 2 | 1 | 2023-01-17 |  |
| sloučit sem | [37959](https://app.pipedrive.com/organization/37959) | SZŠ Vinohrady, Ruská, Praha 10 | 0 / 0 | 1 | 2025-01-29 |  |

### `00854824` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3110](https://app.pipedrive.com/organization/3110) | Waldorfská základní škola a střední škola Semily, příspěvková organizace | 0 / 2 | 2 | 2021-05-17 | `854824` |
| sloučit sem | [9468](https://app.pipedrive.com/organization/9468) | Waldorfská ZSŠ Semily, p.o. – Tyršova 485, Semily | 0 / 0 | 0 | 2023-01-17 |  |

### `25607375` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [27207](https://app.pipedrive.com/organization/27207) | MICHAEL-SŠ a VOŠ rekl. a umělec. tvorby, Machkova 1646/1 | 0 / 2 | 3 | 2024-04-04 |  |
| sloučit sem | [8868](https://app.pipedrive.com/organization/8868) | MICHAEL-SŠ a VOŠ rekl. a umělec. tvorby | 0 / 0 | 1 | 2023-01-17 |  |

### `27441253` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [5068](https://app.pipedrive.com/organization/5068) | Soukr. osm. gymn. DINO-H. SCHOOL s.r.o. | 0 / 1 | 3 | 2021-07-16 |  |
| sloučit sem | [39221](https://app.pipedrive.com/organization/39221) | Královské gymnázium Petrovice s.r.o. | 0 / 1 | 1 | 2025-05-01 |  |

### `28827147` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [28160](https://app.pipedrive.com/organization/28160) | Mateřská škola a Základní škola Na cestě, s.r.o. | 0 / 2 | 1 | 2024-08-26 | `288 27 147` |
| sloučit sem | [34257](https://app.pipedrive.com/organization/34257) | MŠ a ZŠ Na cestě, s.r.o. – Husova 168, Pardubice | 0 / 0 | 0 | 2024-10-23 |  |

### `44553145` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3992](https://app.pipedrive.com/organization/3992) | Základní škola – Rabasova 3282/3, Ústí nad Labem | 0 / 2 | 6 | 2021-05-17 |  |
| sloučit sem | [37607](https://app.pipedrive.com/organization/37607) | Zš Rabasova | 0 / 0 | 1 | 2025-01-08 |  |

### `47274743` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3792](https://app.pipedrive.com/organization/3792) | Základní škola a Mateřská škola – Školní 1544/5, Děčín | 0 / 2 | 2 | 2021-05-17 |  |
| sloučit sem | [36151](https://app.pipedrive.com/organization/36151) | Základní škola a Mateřská škola – Školní 1544/5, Děčín | 0 / 0 | 1 | 2024-10-26 |  |

### `47813032` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4016](https://app.pipedrive.com/organization/4016) | Základní škola – U Hřiště 1242/4, Opava | 0 / 2 | 4 | 2021-05-17 |  |
| sloučit sem | [39664](https://app.pipedrive.com/organization/39664) | Základní škola Opava-Kylešovice, příspěvková organizace | 0 / 0 | 0 | 2026-02-09 |  |

### `60103264` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [6713](https://app.pipedrive.com/organization/6713) | Dětský domov se školou Chrudim | 0 / 2 | 1 | 2021-09-22 | `601 03 264` |
| sloučit sem | [35508](https://app.pipedrive.com/organization/35508) | DD se školou, SVP a ZŠ – Čáslavská 624, Chrudim | 0 / 0 | 3 | 2024-10-23 |  |

### `68321261` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [7767](https://app.pipedrive.com/organization/7767) | Střední škola technických oborů, Havířov | 0 / 1 | 2 | 2022-04-08 | `683 212 61` |
| sloučit sem | [9534](https://app.pipedrive.com/organization/9534) | STŘEDNÍ ŠKOLA TECHNICKÝCH OBORŮ  Havířov-Šumbark, Lidická 1a/600, příspěvková  organizace | 0 / 1 | 1 | 2023-01-17 |  |

### `70436169` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [3634](https://app.pipedrive.com/organization/3634) | Základní škola a Mateřská škola – Větrná 1063, Uherské Hradiště | 0 / 2 | 5 | 2021-05-17 |  |
| sloučit sem | [39493](https://app.pipedrive.com/organization/39493) | Základní škola a Mateřská škola, Uherské Hradiště, Větrná 1063, příspěvková organizace | 0 / 0 | 3 | 2025-10-05 |  |

### `70631026` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [4119](https://app.pipedrive.com/organization/4119) | Fakultní základní škola – Hálkova 335/4, Olomouc | 0 / 2 | 6 | 2021-05-17 |  |
| sloučit sem | [39212](https://app.pipedrive.com/organization/39212) | Fakultní základní škola Olomouc, Hálkova 4, příspěvková organizace | 0 / 0 | 0 | 2025-04-29 |  |

### `70659133` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [8641](https://app.pipedrive.com/organization/8641) | Základní škola a Mateřská škola Hořepník | 0 / 2 | 1 | 2022-11-25 | `706 591 33` |
| sloučit sem | [35488](https://app.pipedrive.com/organization/35488) | Základní škola a Mateřská škola – Nám. Prof. Bechyně 53, Hořepník | 0 / 0 | 1 | 2024-10-23 |  |

### `70839824` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [35517](https://app.pipedrive.com/organization/35517) | Základní škola praktická – Neklanova 1807, Roudnice nad Labem | 0 / 1 | 3 | 2024-10-23 |  |
| sloučit sem | [39748](https://app.pipedrive.com/organization/39748) | Základní škola speciální, Roudnice nad Labem, Neklanova 1807, příspěvková organizace | 0 / 1 | 1 | 2026-04-09 |  |

### `70984328` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [38873](https://app.pipedrive.com/organization/38873) | Základní škola a Mateřská škola Kluky, okr. Písek | 0 / 2 | 1 | 2025-03-17 |  |
| sloučit sem | [34872](https://app.pipedrive.com/organization/34872) | Základní škola a Mateřská škola – č.p. 86, Kluky | 0 / 0 | 0 | 2024-10-23 |  |

### `75016176` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [35491](https://app.pipedrive.com/organization/35491) | Základní škola a mateřská škola – č.p. 12, Trstěnice | 0 / 1 | 3 | 2024-10-23 |  |
| sloučit sem | [25998](https://app.pipedrive.com/organization/25998) | Základní škola Trstěnice | 0 / 1 | 1 | 2023-10-13 | `750 16 176` |

### `Jana Krocova` ⚠️ **neplatné IČO** — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [36425](https://app.pipedrive.com/organization/36425) | Mediready | 0 / 1 | 1 | 2024-10-31 |  |
| sloučit sem | [36515](https://app.pipedrive.com/organization/36515) | Jana Kročová (doučování) | 0 / 1 | 0 | 2024-11-02 |  |

### `00582336` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [26803](https://app.pipedrive.com/organization/26803) | Střední škola polytechnická, Nerudova 859/59, České Budějovice | 0 / 1 | 0 | 2024-03-12 | `00 582 336` |
| sloučit sem | [9489](https://app.pipedrive.com/organization/9489) | Střední škola polytechnická | 0 / 0 | 2 | 2023-01-17 |  |

### `00602027` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [9238](https://app.pipedrive.com/organization/9238) | Střední zahradnická škola | 1 / 0 | 1 | 2023-01-17 |  |
| sloučit sem | [39445](https://app.pipedrive.com/organization/39445) | Střední zahradnická škola, Ostrava, příspěvková organizace | 0 / 0 | 0 | 2025-09-16 |  |

### `00664740` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [36592](https://app.pipedrive.com/organization/36592) | SOŠ a SOU Beroun Hlinky | 0 / 1 | 0 | 2024-11-04 |  |
| sloučit sem | [8904](https://app.pipedrive.com/organization/8904) | SOŠ a SOU | 0 / 0 | 0 | 2023-01-17 |  |

### `01228251` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39823](https://app.pipedrive.com/organization/39823) | "KRPŠ při ZŠ Hustopeče nad Bečvou" | 1 / 0 | 0 | 2026-06-24 |  |
| sloučit sem | [39822](https://app.pipedrive.com/organization/39822) | "KRPŠ při ZŠ Hustopeče nad Bečvou" | 0 / 0 | 1 | 2026-06-24 |  |

### `01811193` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2662](https://app.pipedrive.com/organization/2662) | Waldorfská základní škola Dobromysl z.ú. | 0 / 1 | 1 | 2021-05-17 | `1811193` |
| sloučit sem | [9625](https://app.pipedrive.com/organization/9625) | Waldorfská ZŠ a SŠ Dobromysl z.ú. – Husova 1126/43, Plzeň | 0 / 0 | 2 | 2023-01-17 |  |

### `02640007` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [2377](https://app.pipedrive.com/organization/2377) | Základní škola a Střední škola JEDNA RADOST Pňov-Předhradí | 0 / 1 | 2 | 2021-05-17 | `2640007` |
| sloučit sem | [9627](https://app.pipedrive.com/organization/9627) | ZŠ a SŠ JEDNA RADOST – Školní 73, Pňov-Předhradí | 0 / 0 | 1 | 2023-01-17 |  |

### `15060977` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [36374](https://app.pipedrive.com/organization/36374) | Akademie – Vyšší odborná škola, Gymnázium a Střední odborná škola uměleckoprůmyslová Světlá nad Sázavou | 0 / 1 | 1 | 2024-10-30 |  |
| sloučit sem | [9511](https://app.pipedrive.com/organization/9511) | Akademie-VOŠ, Gymn. a SOŠ uměleckoprům. | 0 / 0 | 0 | 2023-01-17 |  |

### `19133243` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [35299](https://app.pipedrive.com/organization/35299) | ScioŠkola Brno Trnitá – ZŠ, s.r.o. – Šujanovo náměstí 356, Brno | 0 / 1 | 2 | 2024-10-23 |  |
| sloučit sem | [39543](https://app.pipedrive.com/organization/39543) | Scio škola Brno Trnitá | 0 / 0 | 0 | 2025-11-06 |  |

### `22842292` — 2 záznamy · obsah na víc záznamech

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [8629](https://app.pipedrive.com/organization/8629) | Eduteam – centrum celoživotního vzdělávání z.s. | 0 / 1 | 1 | 2022-11-21 |  |
| sloučit sem | [39419](https://app.pipedrive.com/organization/39419) | Eduteam-centrum celoživotního vzdělávání z.s. | 0 / 0 | 1 | 2025-09-09 |  |

### `46773495` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [8557](https://app.pipedrive.com/organization/8557) | Střední škola pedagogická, hotelnictví a služeb, Litoměřice příspěvková organizace | 0 / 1 | 1 | 2022-11-02 | `467 73 495` |
| sloučit sem | [9022](https://app.pipedrive.com/organization/9022) | SŠ pedagogická, hotelnictví a služeb | 0 / 0 | 0 | 2023-01-17 |  |

### `72745134` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [37614](https://app.pipedrive.com/organization/37614) | Základní škola a mateřská škola Čížkovice | 0 / 1 | 2 | 2025-01-09 |  |
| sloučit sem | [34729](https://app.pipedrive.com/organization/34729) | Základní škola a mateřská škola – Benešova 236, Čížkovice | 0 / 0 | 0 | 2024-10-23 |  |

### `75020068` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [34362](https://app.pipedrive.com/organization/34362) | Základní škola a Mateřská škola – č.p. 104, Drnovice | 0 / 1 | 1 | 2024-10-23 |  |
| sloučit sem | [39634](https://app.pipedrive.com/organization/39634) | ZÁKLADNÍ ŠKOLA A MATEŘSKÁ ŠKOLA DRNOVICE, okres Zlín, příspěvková  organizace | 0 / 0 | 0 | 2026-02-03 |  |

### `75023776` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39077](https://app.pipedrive.com/organization/39077) | ZŠ a MŠ Jakubov, příspěvková organizace | 0 / 1 | 1 | 2025-04-01 |  |
| sloučit sem | [34777](https://app.pipedrive.com/organization/34777) | Základní škola a Mateřská škola – č.p. 130, Jakubov u Moravských Budějovic | 0 / 0 | 0 | 2024-10-23 |  |

### `00669709` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [26656](https://app.pipedrive.com/organization/26656) | Střední zdravot.škola a VOŠ zdravotnická, Poděbradská 1247/2 | 0 / 0 | 1 | 2024-02-27 | `00 669 709` |
| sloučit sem | [9282](https://app.pipedrive.com/organization/9282) | Střední zdravot.škola a VOŠ zdravotnická | 0 / 0 | 0 | 2023-01-17 |  |

### `05055806` — 2 záznamy · jen 1 záznam má data

| | ID | Název | Obchody (otevř./uzavř.) | Osoby | Vznik | Zápis IČO |
|---|---|---|---|---|---|---|
| **ponechat** | [39717](https://app.pipedrive.com/organization/39717) | Základní organizace Základní škola Ostrava, Zelená 42 | 0 / 0 | 1 | 2026-02-27 |  |
| sloučit sem | [39229](https://app.pipedrive.com/organization/39229) | 05055806	Základní organizace Základní škola | 0 / 0 | 0 | 2025-05-06 | `05055806	Základní organizace Základní škola` |

## Nesmyslné IČO

Tyto záznamy mají v poli IČO nulu nebo náhodný text — nejde o duplicity mezi sebou, jen se slévají do jedné hodnoty a znemožňují párování.

| ID | Zápis | Název | Obchody | Osoby |
|---|---|---|---|---|
| [7804](https://app.pipedrive.com/organization/7804) | `000000` | Individuální vzdelavani | 0 | 0 |
| [9675](https://app.pipedrive.com/organization/9675) | `0` | OSVČ | 0 | 0 |
| [25796](https://app.pipedrive.com/organization/25796) | `0` | Křesťanská základní škola a mateřská škola J. A. Komenského | 0 | 0 |
| [26698](https://app.pipedrive.com/organization/26698) | `00000dsa` | Doplň správnou organizaci podle IČO | 0 | 0 |
| [27117](https://app.pipedrive.com/organization/27117) | `0000awda` | Doplň správnou organizaci podle IČO | 0 | 0 |
| [27839](https://app.pipedrive.com/organization/27839) | `0000000-` | Doplň správnou organizaci podle IČO | 0 | 0 |
| [32263](https://app.pipedrive.com/organization/32263) | `000000DShd` | Komunitní | 0 | 0 |
| [37298](https://app.pipedrive.com/organization/37298) | `0` | Ingeniero Rogelio Boero | 0 | 0 |
| [38991](https://app.pipedrive.com/organization/38991) | `0` | Žádná | 0 | 0 |
| [39018](https://app.pipedrive.com/organization/39018) | `0` | Eva Strmenová | 0 | 0 |
| [39021](https://app.pipedrive.com/organization/39021) | `0` | Ondřej Klauser | 0 | 0 |
| [39061](https://app.pipedrive.com/organization/39061) | `0` | Kamila Lukášová | 0 | 0 |
| [39248](https://app.pipedrive.com/organization/39248) | `00000000` | 00000000 | 0 | 0 |
| [39420](https://app.pipedrive.com/organization/39420) | `0` | Lucie Kroužilová | 0 | 0 |
| [39441](https://app.pipedrive.com/organization/39441) | `0` | Anna Shivalanka | 0 | 0 |
| [39444](https://app.pipedrive.com/organization/39444) | `0` | Daniel Vinický | 0 | 0 |
| [39455](https://app.pipedrive.com/organization/39455) | `0` | Tereza Trtíková | 0 | 0 |
| [39731](https://app.pipedrive.com/organization/39731) | `0` | Kenski - domškola | 0 | 0 |
| [39758](https://app.pipedrive.com/organization/39758) | `0` | Zdenka Juklová | 0 | 0 |
| [39805](https://app.pipedrive.com/organization/39805) | `0` | Alžběta Purkertová | 0 | 0 |
| [39826](https://app.pipedrive.com/organization/39826) | `0` | Jitka Fouňová | 0 | 0 |
