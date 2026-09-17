# Slovní úlohy — podklad pro mailing (pondělí 21. 9. 2026)

Mapa toho, co je hotové, co se teprve chystá a co kde v systému leží. Stav k 17. 9. 2026.

## 1 · Aplikace Slovní úlohy (František Cáb)

Žije v repu `vividbooks-ultra`, `frontend/src/app/features/ulohy-app/` a `frontend/src/app/pages/ulohy-app/`.
Dlaždice v regálu se ukazuje jen u matematiky a jen na 2. stupni.

| | |
|---|---|
| Název v produkci | **Slovní úlohy** |
| Routa | `/aplikace/ulohy` |
| Pořadí v regálu | Početník → Slovní úlohy → Přijímací zkoušky → katalogové aplikace |
| Stav v produkci | vydáno, zatím jen pro admina (`RequireAdminAuth` + skryté knihy) |
| Uvítací dialog | „Vítejte v testovací verzi aplikace Slovní úlohy“ |

### Témata v produkci

Generátory jsou psané na 6.–9. ročník, každý s vlastním úvodem pro žáka a se třemi úrovněmi obtížnosti.

| Karta | Režimy | Ročník |
|---|---|---|
| Úměrnosti | přímá, nepřímá, přímá i nepřímá | 7 |
| Procenta | jednoduché slovní úlohy, pokročilé slovní úlohy | 7 |
| Slovní úlohy řešitelné pomocí rovnic | jednoduché (podle sešitu 8), pokročilé (pohyb, procenta z neznámého základu, zadání z přijímaček) | 8 |
| Geometrické úlohy (rovinné útvary) | čtverec a obdélník, rovnoběžníky, trojúhelník, lichoběžník, Pythagorova věta, kruh, kružnice a mnohoúhelníky, složené obrazce, úhly v rovině | 6–8 |
| Geometrické úlohy (tělesa) | krychle a kvádr | 6 |

### Co aplikace umí

- **Procvičování s adaptivní obtížností.** Dvě správné odpovědi za sebou → úroveň nahoru, dvě chybné → dolů. Učitel nastaví rozsah „od“ a „do“.
- **Počet úloh** 10 / 20 / 30 / 50, nebo neomezeně (jen v režimu „Procvičovat hned“).
- **Pracovní list** — učitel řekne, kolik úloh chce z které úrovně, a vypadne PDF do tisku. Strop je 100 úloh na list.
- **Board** — stejná sada úloh jako board na tabuli (vyžaduje zabezpečený účet).
- **Zadání pro celou třídu** — relace, výsledky pohromadě (vyžaduje zabezpečený účet).
- **Ke každé úloze řešení i postup.** Úlohy mají obrázky (hotová SVG z generátoru), tabulky, výběr z nabídky i tvrzení pravda/nepravda.
- **Hodnocení úloh.** Po každé úloze palec 1–3 („Úloha byla super / Nic moc / Úloha byla špatná“), u nejhoršího stupně i komentář. Zatím se nedá vypnout — je to hlavní zdroj zpětné vazby z testovací verze.

### Co je rozpracované ve větvi `ULOHY2` (do produkce zatím nejde)

Slovní a početní úlohy (přirozená / necelá / záporná čísla), Aritmetický průměr, Poměr, Soustavy rovnic,
Hranoly, Algebraické výrazy (sčítání a odčítání, násobení, rozklad na součin) a přijímačkový termín 2026B.
Přepínač „Hodnotit úlohy“ se tam dá vypnout a aplikace se ve větvi jmenuje jen „Úlohy“.

## 2 · Přijímací zkoušky (navazuje)

Samostatná dlaždice, routa `/aplikace/prijimaci-zkousky`, v produkci taky jen pro admina.

- Oficiální didaktické testy CERMAT z matematiky pro **čtyřleté obory**: 2025A (1. řádný), 2025B (2. řádný), 2025C (1. náhradní), 2025D (2. náhradní), 2026A (1. řádný). Ve větvi navíc 2026B.
- Šestnáct úloh za padesát bodů, **v pořadí, ve kterém je žák dostal u zkoušky** — nelosuje se.
- **Body podle oficiálního klíče** CERMAT, včetně dělení po polích a svazků 4/2/0 a 6/4/2.
- **Časomíra** — výchozí 70 minut (oficiální délka testu), přednastavené 40 / 70 / 90, rozsah 1–180 minut.
- **Okamžité hodnocení** se dá vypnout, aby si žák prošel test jako u zkoušky.
- Konstrukční úlohy jsou označené jako „na papír“ — vyhodnotit se nedají, žák si po narýsování zobrazí řešení.
- K podobným úlohám umí generátor dolosovat variantu, která se ale nepočítá do padesátibodové škály.
- Odkaz na stažení originálního zadání na webu CERMAT je přímo v aplikaci.

## 3 · Webináře

### 30. 9. 2026 — Naďa Vondrová (už běží, registrace otevřená)

- **Jak na slovní úlohy: Proč v nich žáci chybují a jak jim pomoct**
- prof. RNDr. Naďa Vondrová, Ph.D., Pedagogická fakulta UK
- Středa 30. 9. od 18:00, 90 minut, live stream, certifikát DVPP přes anketu
- Cílovka: učitelé matematiky 1. stupně ZŠ · tagy: matematika, 1. stupeň, DVPP
- Obsah: situační model, concept cartoons, vizuální podpora, čtení s porozuměním na textu úloh, úlohy s komplikujícími parametry
- `/webinar/jak-na-slovni-ulohy`

### 14. 10. 2026 — František Cáb (nově založeno)

- **Jak na slovní úlohy na 2. stupni – a nová aplikace, která je umí generovat**
- Středa 14. 10. od 18:00, 90 minut, live stream, certifikát DVPP přes anketu
- Cílovka: učitelé matematiky 6.–9. ročníku · tagy: matematika, 2. stupeň, DVPP
- První polovina navazuje na Vondrovou a překlápí to do praxe 6.–9. ročníku, druhá je živá prohlídka aplikace Slovní úlohy a výhled na Přijímací zkoušky
- `/webinar/jak-na-slovni-ulohy-2-stupen`

## 4 · Mailing

- Draft `slovni-ulohy-rijen-2026` v `/mailing/emaily`
- Předmět: *Slovní úlohy: nová aplikace a dva webináře zdarma 🧮*
- Preheader: *Od pondělí v knihovně matematiky. A 30. 9. i 14. 10. o nich vysíláme.*
- Hlavní CTA: **Otevřít Slovní úlohy** → `https://app.vividbooks.com/aplikace/ulohy` (opakuje se v závěru)
- Skladba: hero → háček → co aplikace umí + screenshot + CTA → „A takhle to vidí žák“ + screenshot → zvýrazněný box o testovací verzi → karta webináře 30. 9. → karta webináře 14. 10. → přijímačky + závěrečné CTA

### Screenshoty

Dva záběry z aplikace, pořízené z větve `production` v headless Chrome (1180 px a 1060 px šířky,
2× DPI), zarámované na 1200 px se zaoblením 18 px a jemným okrajem, nahrané do bucketu
`make-93a20b6f-images`:

| Co | Soubor v bucketu |
|---|---|
| Výběr tématu + tři způsoby zadání | `1789677772776-u7v86kdfjg.png` |
| Vyřešená úloha s náčrtem a hodnocením | `1789677774628-l7958lwln0t.png` |

Při focení byl skrytý ladicí pruh `.ulohy-practice__debug` — viz níže.

### Než se pustí ostrá kampaň

1. **Shodit admin-only zámek** na obou aplikacích, aby odkaz v mailu učiteli fungoval. Bez toho CTA nikam nevede.
2. Doplnit **YouTube odkaz** na live stream u webináře 14. 10.
3. Vyměnit **cover webináře 14. 10.** — teď je vypůjčený ze zářijového webináře o matematice na 2. stupni.
4. Zkontrolovat v mobilu a pak teprve vybírat audienci.

### Našlo se při focení

V procvičování jsou pod polem odpovědi tlačítka **„Odpovědět dobře“ a „Odpovědět špatně“**
(`ulohy-practice__debug` v `UlohyPracticeChrome.tsx`). Nejsou schovaná za `import.meta.env.DEV`,
takže jsou i v produkčním buildu — dokud aplikaci vidí jen admin, nevadí to, ale ve chvíli, kdy
se otevře učitelům a žákům, je to tlačítko „vyřeš to za mě“. Stojí za to je před pondělkem
schovat.
