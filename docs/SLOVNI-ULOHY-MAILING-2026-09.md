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

Stav odečtený z běžící produkce 21. 9. (karty a chipy tak, jak je učitel vidí):

| Karta | Režimy |
|---|---|
| Slovní a početní úlohy | přirozená čísla, necelá čísla, záporná čísla |
| Aritmetický průměr | aritmetický průměr |
| Úměrnosti | přímá, nepřímá, přímá i nepřímá, poměr, podobnost |
| Procenta | jednoduché slovní úlohy, pokročilé slovní úlohy |
| Slovní úlohy řešitelné pomocí rovnic | jednoduché, pokročilé, soustavy rovnic, úlohy o pohybu, úlohy o společné práci |
| Geometrické úlohy (rovinné útvary) | čtverec a obdélník, rovnoběžníky, trojúhelník, lichoběžník, Pythagorova věta, kruh, kružnice a mnohoúhelníky, složené obrazce, úhly v rovině |
| Geometrické úlohy (tělesa) | krychle a kvádr, hranoly, válec |
| Statistika | statistika |

Karty Algebraické výrazy, Soustavy rovnic, Přirozená čísla a přijímačkové (Cermat, Témata, Test)
existují, ale v aplikaci Slovní úlohy se nezobrazují — `listedTopics()` odfiltruje `vyrazy-*`
a `prijimacky-*`. Patří do Přijímacích zkoušek.

### Co aplikace umí

- **Procvičování s adaptivní obtížností.** Dvě správné odpovědi za sebou → úroveň nahoru, dvě chybné → dolů. Učitel nastaví rozsah „od“ a „do“.
- **Počet úloh** 10 / 20 / 30 / 50, nebo neomezeně (jen v režimu „Procvičovat hned“).
- **Pracovní list** — učitel řekne, kolik úloh chce z které úrovně, a vypadne PDF do tisku. Strop je 100 úloh na list.
- **Board** — stejná sada úloh jako board na tabuli (vyžaduje zabezpečený účet).
- **Zadání pro celou třídu** — relace, výsledky pohromadě (vyžaduje zabezpečený účet).
- **Ke každé úloze řešení.** Postupy výpočtu zatím nejsou. Úlohy mají obrázky (hotová SVG z generátoru), tabulky, výběr z nabídky i tvrzení pravda/nepravda.
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

### 14. 10. 2026 — Naďa Vondrová (nově založeno)

- **Jak na slovní úlohy v 6.–9. ročníku ZŠ**
- prof. RNDr. Naďa Vondrová, Ph.D., Pedagogická fakulta UK
- Středa 14. 10. od 18:00, 90 minut, live stream, certifikát DVPP přes anketu
- Cílovka: učitelé matematiky 6.–9. ročníku · tagy: matematika, 2. stupeň, DVPP
- Totéž téma jako 30. 9., ale pro druhý stupeň: zlomky, procenta, úměrnosti, rovnice, geometrie
- Cover: `1789681633020-qe2iryx5eks.png` (1920×1080, pozadí `#001161`), `coverImageBgColor` na `#001161`
- `/webinar/jak-na-slovni-ulohy-2-stupen`
- Webinář byl původně založený na Františka Cába s představením aplikace. Podle grafiky z Figmy
  (VIVIDBOOKS MARKETING, node 22698-83) ho vede Vondrová, takže lektor, název i popis jsou přepsané
  a představení aplikace z programu i z mailu vypadlo.

## 4 · Mailing

- Draft `slovni-ulohy-rijen-2026` v `/mailing/emaily`
- Předmět: *Slovní úlohy: nová aplikace a dva webináře*
- Preheader: *Od úterý v knihovně matematiky. Webináře 30. září a 14. října.*
- Hlavní CTA: **Otevřít Slovní úlohy** → `https://app.vividbooks.com/aplikace/ulohy` (opakuje se v závěru)
- Skladba: hero → úvodní slovo Vítka Škopa (jeho text, opravené překlepy z diktování) → co to je → témata + screenshot + režimy + CTA → „Jak vypadá procvičování“ + screenshot → box o testovací verzi → karta webináře 30. 9. → karta webináře 14. 10. → přijímačky + závěrečné CTA
- Podepsaný je nahoře Vítek Škop, dole už se podruhé nepodepisujeme.
- Tón: věcný. Žádné emoji v nadpisech, žádné oslovování sborovny, žádné díky za komentáře — co aplikace dělá, kdy, kde a za jakých podmínek.

### Screenshoty

Dva záběry z aplikace, pořízené z větve `production` v headless Chrome (1180 px a 1060 px šířky,
2× DPI). Každý je pak vysázený na 1200 px jako okno prohlížeče — tmavě modré plátno `#001161`,
bílá lišta s puntíky a adresou `app.vividbooks.com/aplikace/ulohy`, nad oknem bílá bublina
s popiskem. Obojí v bucketu `make-93a20b6f-images`:

| Co | Popisek v bublině | Soubor v bucketu |
|---|---|---|
| Výběr tématu + tři způsoby zadání | Výběr tématu a způsobu zadání | `1789707539043-sih0vmh5lat.png` |
| Vyřešená úloha s náčrtem a hodnocením | Procvičování s adaptivní obtížností | `1789707540699-6nast0r7i9x.png` |

Při focení byl skrytý ladicí pruh `.ulohy-practice__debug` — viz níže.

### Než se pustí ostrá kampaň

1. **Shodit admin-only zámek** na obou aplikacích, aby odkaz v mailu učiteli fungoval. Bez toho CTA nikam nevede.
   Odemyká se **v úterý 22. 9.** — mail je podle toho přepsaný („Od úterý 22. září najdete…“).
   K 21. 9. večer je `RequireAdminAuth` v `origin/production` u `/aplikace/ulohy`
   i `/aplikace/prijimaci-zkousky` pořád.
2. Doplnit **YouTube odkaz** na live stream u webináře 14. 10.
3. ~~Cover webináře 14. 10.~~ — hotovo. Grafika z Figmy je nahraná, na webu i v kartě v mailu.
4. Zkontrolovat v mobilu a pak teprve vybírat audienci.

### Obrázky v mailu se nezobrazují

Prověřeno 21. 9.: všechny čtyři obrázky (dva screenshoty, dva covery webinářů) vrací z bucketu
HTTP 200, `content-type: image/png`, a hlavičky se shodují s obrázkem, který prošel ostrou
kampaní. Po odesílací kompilaci (`compileEmailBodyForSend`) zůstávají v HTML všechny čtyři
`<img>` i s alt texty a celé tělo má 19 kB, takže Gmail zprávu neořezává (ořez je nad ~102 kB).
Příčina je tedy na straně klienta — nenačtené externí obrázky.

### Našlo se při focení

V procvičování jsou pod polem odpovědi tlačítka **„Odpovědět dobře“ a „Odpovědět špatně“**
(`ulohy-practice__debug` v `UlohyPracticeChrome.tsx`). Nejsou schovaná za `import.meta.env.DEV`,
takže jsou i v produkčním buildu — dokud aplikaci vidí jen admin, nevadí to, ale ve chvíli, kdy
se otevře učitelům a žákům, je to tlačítko „vyřeš to za mě“. Stojí za to je před pondělkem
schovat.
