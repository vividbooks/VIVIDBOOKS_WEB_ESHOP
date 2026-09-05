# DVPP zdarma jako lead magnet: strategie „Netflix pro sborovny"

*Vividbooks · podklad k rozhodnutí · 3. září 2026*

Cíl projektu: zdvojnásobit (ideálně ztrojnásobit) bázi aktivních kontaktů za čtyři měsíce a dostat DVPP zdarma do každé základní školy v Česku. Dokument shrnuje výchozí stav (kód i data), trh, produktovou tezi, přístupový model, referral mechaniku, databázi škol, funnel, kanály, měření, plán po fázích, technické zadání a rizika.


## 0 · Shrnutí na jednu stránku

**Teze.** DVPP zdarma přestane být stránka se seznamem záznamů a stane se knihovnou s účtem, certifikáty a sborovnou: učitel se přihlásí e-mailem, kouká na řady webinářů, po kvízu si stáhne osvědčení DVPP a vidí, kolik kolegů z jeho školy chybí k tomu, aby měla záznamy zdarma celá sborovna. Ředitel dostane školní kód a výkaz hodin DVPP za sbor. Vividbooks je v tom všem odpověď, ne téma.

**Startovní čára je nižší, než si myslíme.** V databázi je 32 590 řádků, ale aktivních odběratelů je 24 413 a e-mail za poslední čtvrtletí otevřela jen pětina. Cíl proto zní: **48 000 aktivních odběratelů se školou k 31. 12. 2026**, ambice 72 000 (to je prakticky každý učitel ZŠ v zemi).

**Pět rozhodnutí, která strategie navrhuje:**

1. **Sborovna místo předplatného.** Platba 450 Kč nezvětšuje bázi a u školy stojí víc administrativy než peněz. Přístup pro celou školu se odemyká milníkem potvrzených kolegů; platba (990 Kč/rok) zůstává jen jako alternativa pro školu, která zvát nechce.
2. **Milník podle velikosti sboru, ne fixních 20.** Dnes má 20+ kontaktů 32 škol. Navrhujeme 4 / 8 / 12 / 16 potvrzených podle velikosti školy (cca třetina sboru), s odměnou už za prvního kolegu. Komunikace navenek: „Když se přidá třetina sborovny, mají to zdarma všichni."
3. **Učitel sdílí sám, ředitel rozesílá školní kód.** Zadávání e-mailů kolegů s pobídkou je podle evropské praxe naše obchodní sdělení bez souhlasu příjemce. Osobní odkaz, QR do sborovny a školní kód přes ředitele jsou stejně účinné a právně čisté.
4. **Certifikát po kvízu jako hlavní měna.** Akreditace DVPP byla zrušena (2023, definitivně od 28. 2. 2025), o uznání rozhoduje ředitel. Certifikát ze záznamu s ověřením znalostí je rovnocenný živému webináři; slovo „akreditované" z webu zmizí. Řady po 8 hodinách se souhrnným osvědčením sedí do šablon OP JAK.
5. **Měřit od prvního dne.** Meta Pixel + Conversions API, GA4, UTM a vlastní tabulka událostí, severní hvězda „aktivní odběratel se školou", týdenní 30minutové review.

**Odkud přijde 24 000 nových kontaktů (střední odhad):** živé webináře 7 000, sborovny a referral 8 000, ředitelé 5 000, upoutávky a skupiny 2 500, placená Meta kampaň 2 000. Rozpětí 16 000–35 000. Dvojnásobek je dosažitelný, trojnásobek je hranice trhu.

**Co udělat tento měsíc, ještě před knihovnou:** (1) zapisovat leady ze záznamů do `subscribers`, dnes končí v KV a mailing je nevidí; (2) přidat výběr školy z rejstříku do registrace na webinář; (3) nasadit měření; (4) importovat rejstřík škol se statistikou velikosti a dopárovat 3 900 školních domén. Bez toho zářijová vlna (175 kontaktů denně) proteče bez užitku.

**Největší rizika:** nedosažitelný práh, stížnosti na pozvánky, pád doručitelnosti na Seznamu při dvojnásobném objemu, střih 100+ záznamů. Všechna mají v kapitole 12 konkrétní protiopatření.

**Konkurence už existuje:** Eduall prodává knihovnu záznamů s osvědčením (sborovna od 15 000 Kč/rok), Učitelnice ji dává zdarma. Nikdo nekombinuje zdarma + osvědčení ze záznamu + odemknutí pro sborovnu. Náskok je obsah a 600 zákaznických škol, ne mechanika.


## 1 · Výchozí stav: co máme a co chybí

### Báze kontaktů (produkční databáze `subscribers`, stav 3. 9. 2026)

| Ukazatel | Hodnota | Poznámka |
|---|---|---|
| Kontaktů celkem | 32 590 | z toho 31 022 z importu Mailchimpu |
| Aktivních odběratelů (`subscribed`) | **24 413** | reálná startovní čára, ne 30 000 |
| Odhlášených | 3 813 | |
| Vyčištěných (bounce) | 3 256 | |
| Otevřeli e-mail za 30 dní | 4 107 | 17 % báze |
| Otevřeli e-mail za 90 dní | 4 967 | 20 % báze; 21 776 kontaktů má tag „Chladný (>90 dní)" |
| Nových za 120 dní | 1 538 | ~13 denně mimo sezónu |
| Nových v srpnu 2026 | 1 045 | miniwebináře k nové aplikaci |
| Nových 1.–3. září 2026 | 529 | zářijová série: ~175 denně |
| Označeni jako zákazník | 20 | pole `is_customer` se prakticky neplní; tag „Customer" má 6 386 kontaktů |
| Kontaktů s vyplněnou školou v profilu | 0 | `school_name` v merge polích je prázdné, IČO má 22 platných z 5 982 (audit v `docs/IDENTITY_A_MERENI.md`) |

**Pozice** (kde je známa): učitel 7 995 + 396 (ZŠ) + 510 (fyzika) + 141 (chemie) + 82; ředitel 1 496; zástupce 857; student 1 618; rodič 776; „jiné" 2 589; **neznámá u 7 362**.

**Odkud jsou e-maily:** seznam.cz 5 205, gmail.com 4 813, centrum.cz 747, email.cz 664. Freemaily tvoří polovinu báze. **Školních (nefreemailových) domén je 3 907 s 11 989 kontakty**. Z nich má 751 domén 5 a více kontaktů, ale jen **32 domén 20 a více**. Tři nejsilnější školy: 42, 42 a 41 kontaktů na doméně.

Co z toho plyne:

1. Startovní čára pro cíl „2×" je 24 400 aktivních, ne 30 000. Cíl na 31. 12. 2026 tedy zní **48 000 aktivních odběratelů** (2×) a ambice **72 000** (3×).
2. Báze je studená: jen pětina lidí otevřela e-mail za poslední čtvrtletí. Zdvojnásobení počtu bez zdvojnásobení aktivity je k ničemu. Metrika projektu proto musí být „aktivní odběratel se školou", ne „řádek v tabulce".
3. **Ve školách už jsme.** Přes školní domény máme stopu odhadem ve 3 000+ školách (část domén jsou gymnázia, SŠ, MŠ a instituce). To je největší aktivum projektu: první učitel ve škole už většinou existuje, jen o něm nevíme, ve které škole je, protože registrace školu neukládá.
4. Práh „20 kolegů" splňuje dnes 32 škol. Pro zbytek je to daleko.

### Web DVPP zdarma dnes (repo `VIVIDBOOKS_WEB_ESHOP`)

- **Doména dvppzdarma.cz** servíruje komponentu `DvppLeadMagnetPage` (`src/components/DvppLeadMagnetPage.tsx`), stejná stránka běží i na `/dvpp-webinare`. Hero „DVPP webináře zdarma pro pedagogy ZŠ", 6 natvrdo vybraných záznamů, chipy témat (fyzika, matematika, chemie, přírodopis, prvouka, český jazyk, Vividboard, AI, profesní rozvoj, vedení školy, ŠVP), trojkrokový návod k certifikátu, termíny živých webinářů, newsletter banner, blog.
- **Stránka nemá vlastní formulář.** Konverze nastává až o úroveň níž: záznam (`/webinare/zaznam/:id`) je bráněný e-mailem (formulář „plný" se školou a IČO, nebo „lehký" jen jméno + e-mail + telefon), ne přihlášením. Přístup se pamatuje v `localStorage`, takže z jiného zařízení učitel vyplňuje znovu.
- **Certifikát existuje a funguje:** AI vygeneruje 4 otázky z přepisu webináře (`POST /admin/webinar-generate-dvpp-quiz`), učitel je vyplní ve wizardu (`WebinarDvppQuizPlayer`), zadá jméno, datum narození, školu a IČO a stáhne PDF (`src/lib/webinarCertificateDocument.ts`, opraveno 2. 9. 2026). Číslo certifikátu `VB-DVPP-{rok}-{6 znaků}`. Podepisuje MgA. Vít Škop jako statutární zástupce vzdělávacího zařízení.
- **Certifikát neobsahuje číslo akreditace MŠMT** a web přitom v SEO textech a v `llms.txt` uvádí „akreditované DVPP". Akreditace průběžného DVPP byla novelou zákona 563/2004 Sb. zrušena (od 1. 9. 2023, staré akreditace vypršely 28. 2. 2025), takže slovo „akreditované" je dnes nepravdivé a zbytečné. Osvědčení stačí, když program odpovídá § 10 vyhlášky 317/2005 Sb. a ředitel ho uzná. Detail v kapitole 2.
- **Záznamy** žijí v KV (`vividbooks_dvpp_videos_v2`, sync z Webflow CMS) a doplňují se automaticky z proběhlých webinářů s `recordingUrl`. Katalog `/webinare` je seznam s filtrem podle tématu. Žádné řady, upoutávky, „pokračovat ve sledování", hlasování.
- **Registrace na živý webinář** (`POST /webinar-registrace`) je nejbohatší sběrný bod: jméno, e-mail, telefon, pozice, škola (našeptávač z rejstříku), IČO, používá Vividbooks, předměty, stupně, souhlas s newsletterem. Vytváří kontakt v Postgresu, tag v Mailchimpu, osobu v Pipedrive, trial token a osobní odkaz do lobby. Toto je vzor, podle kterého má vypadat i vstup do knihovny.
- **Registrace k záznamu** (`POST /dvpp-video-registrace`) a „lehký lead" ukládají **jen do KV**, ne do tabulky `subscribers`. Tyto kontakty jsou pro mailing neviditelné. První a nejlevnější zásah projektu.
- **Rejstřík škol** je CSV nahrané ručně do Storage (`/marketing/skoly`), parsované do paměti: název, IČO, adresa, kraj, typ, ředitel, e-mail, RED_IZO. **Chybí IZO, počet žáků, počet pedagogů, velikost.** Stránka `/admin/skoly` ukazuje stav školy dotazem do Pipedrive naživo (předplatné / zkouší / open deal / historie / známá / nová), nic se neukládá.
- **Mailing** je vlastní nástroj (Postgres + Resend), s double opt-in, tagy, filtrem audience podle zdroje, pozice a zájmu o předmět, a s automatizacemi (spouštěče `subscriber_created`, `webinar_registered`, `trial_activated`, `order_paid`). Čtyři výchozí sekvence existují jen jako neaktivní kostry s placeholder texty. **Žádná sekvence pro DVPP leady.**
- **Měření:** jen GTM (`GTM-MM6TZG4M`) s Consent Mode v2 a dataLayer e-commerce události. **Žádný Meta Pixel, žádná Conversions API, žádné UTM ukládání, registrace na webinář nepushuje žádnou událost.** Vlastní open/click tracking e-mailů a identifikované návštěvy webu přes cookie `vb_id` (identity graf, `docs/IDENTITY_A_MERENI.md`).
- **Přihlášení učitele na vividbooks.com neexistuje.** Supabase auth slouží jen adminům. Účty učitelů jsou v aplikaci (`nove.vividbooks.com`), spojovací klíč je kód školy + slot učitele.
- **Referral, kupóny, hlasování, gamifikace: nic.** Jediný náznak je otázka v dotazníku po webináři „Přejete si zaškolit vaše kolegy? (DVPP školení zdarma pro celý tým)". Hlasování existuje jen jako aktivita ve Vividboardu v aplikaci (`VotingActivitySlide`), stejně jako nástroj na certifikáty ve slidech.
- **Mini-aplikace** (rýsování, 3D modely, Početník, minihry) jsou jen za licencí nebo trialem, veřejný hub zdarma neexistuje. **BOZP: nula výskytů.**

### Shrnutí mezer, seřazené podle páky

| # | Mezera | Proč to bolí | Náročnost |
|---|---|---|---|
| 1 | Registrace k záznamu nezapisuje do `subscribers` | leady z DVPP zdarma se neobjeví v mailingu | 1 den |
| 2 | Kontakt nemá školu (RED_IZO) | nelze počítat sborovny ani pokrytí škol | 2 dny + zpětné dopárování domén |
| 3 | Žádné měření funnelu (pixel, CAPI, UTM, události) | nelze řídit kampaně ani vyhodnotit 4 měsíce | 3 dny |
| 4 | Žádný referral | jádro projektu | 3 týdny |
| 5 | Přístup k záznamům per zařízení, bez účtu | učitel nemá polici certifikátů ani „pokračovat" | 1 týden (magic link) |
| 6 | Katalog bez řad a upoutávek | knihovna vypadá jako archiv | obsahová práce, průběžně |
| 7 | Claim „akreditované" a náležitosti osvědčení za záznam | riziko u ředitelů a ČŠI | přepsat texty, doplnit náležitosti podle vyhlášky 317/2005, 1 týden |
| 8 | Rejstřík bez velikosti škol | nelze nastavit milníky podle sboru | 1 den (statistika MŠMT) |



## 2 · Trh: kolik škol, jaká pravidla, kdo už to dělá

### Velikost hřiště

| Ukazatel | Hodnota | Zdroj |
|---|---|---|
| Základní školy v ČR | **4 295** (šk. rok 2025/26) | ČSÚ, Mateřské, základní a střední školy |
| z toho malotřídní (neúplné, spojené ročníky) | **1 113–1 294** (26–30 %) | ČŠI; jiné zdroje uvádějí až třetinu ZŠ; 40 % ZŠ má pod 100 žáků (PAQ) |
| Žáci ZŠ | 1 002 900 (590 300 na 1. stupni, 412 700 na 2. stupni) | ČSÚ 2025/26 |
| Učitelé ZŠ, přepočtené úvazky | 72 450 (2024), 76 700 (září 2025) | ČSÚ, ČTK |
| Učitelé 1. stupně, fyzické osoby | 52 400 (průměrný úvazek 0,74) | MŠMT, Mimořádné šetření 2025 |
| Učitelé ZŠ, fyzické osoby celkem | odhad **85 000–95 000** | dopočet z úvazků |
| Průměrná úplná ZŠ | 25–30 pedagogů; malotřídka 3–8 | dopočet |

Co z toho plyne: 24 400 aktivních kontaktů je zhruba čtvrtina učitelů ZŠ (báze ale obsahuje i MŠ, SŠ, rodiče a studenty). **Cíl 48 000 je polovina trhu, 72 000 je trh celý.** Čtvrtina škol jsou malotřídky, kde „20 kolegů" nikdy nebude, a zároveň jsou to školy, kam se komerční DVPP nedostane, takže tam má bezplatná knihovna nejmenší konkurenci.

### Legislativa DVPP 2026: akreditace už neexistuje

- Novela zákona 563/2004 Sb. (účinná od 1. 9. 2023) **zrušila akreditaci programů průběžného vzdělávání**. Akreditovat se dají jen programy vedoucí ke kvalifikaci a specializační studia. Staré akreditace vypršely nejpozději **28. 2. 2025**. Zdroj: MŠMT, Informace k novele zákona o pedagogických pracovnících; Řízení školy.
- Povinnost dalšího vzdělávání (§ 24 zákona 563/2004) trvá: učitel má 12 dnů samostudia ročně a ředitel plánuje DVPP podle plánu. **Co se uzná jako DVPP, rozhoduje ředitel**, pokud program odpovídá § 10 vyhlášky 317/2005 Sb. (průběžné vzdělávání: obsah, rozsah, lektor, doklad o absolvování).
- Osvědčení je tedy věc důvěryhodnosti, ne razítka. Náležitosti, které ředitelé a ČŠI čekají: název a obsah programu, rozsah v hodinách, datum, forma (distanční), lektor, vzdělávací instituce, číslo osvědčení, způsob ověření (u nás kvíz). Náš certifikát tohle má, chybí jen výslovný odkaz na § 10 vyhlášky a rozsah hodin u záznamů podle skutečné délky.

**Důsledek pro projekt:** certifikát ze záznamu s ověřovacím kvízem je právně rovnocenný certifikátu z živého webináře. To je základ, na kterém se knihovna na vyžádání dá postavit. Slovo „akreditované" z webu odstranit; nahradit „osvědčení DVPP podle vyhlášky 317/2005 Sb." a „uznávané řediteli 600+ škol".

### Financování: šablony OP JAK

- Výzva **02_24_034 Šablony pro MŠ a ZŠ II** (žádosti do 30. 9. 2025, realizace do 2027) a navazující výzvy uvolňují 6,5 mld. Kč hlavně na personální podporu a vzdělávání pracovníků. Aktivita „Vzdělávání pracovníků ve vzdělávání" počítá s **minimem 8 hodin na osobu** a hradí celé náklady akce.
- Základní alokace pro ZŠ v Šablonách II je 250 000 Kč + 2 000 Kč na žáka (+ 1 000 Kč na dítě ve družině). Jednotka „vzdělávání pracovníků" (8 h/osoba) se uvádí kolem 3 400 Kč; tento údaj se nepodařilo ověřit v oficiálním dokumentu. Od 1. 1. 2026 část ostatních neinvestičních výdajů včetně DVPP financují zřizovatelé přes rozpočtové určení daní, takže rozpočet na DVPP bude škola od školy jiný a méně předvídatelný.
- Ředitelé tedy potřebují **vykázat hodiny**, ne nutně utratit peníze. Bezplatný program s osvědčením na 8 hodin (řada 4 webinářů) je pro ně vykazatelný stejně jako placený seminář. Pro školy bez šablon je to úspora: Tvořivá škola bere 590–1 190 Kč za osobu a webinář, klub Online sborovna (Učíme společně) 6 000 Kč za rok.
- Doporučení: balit záznamy do **řad po 8 hodinách** se souhrnným osvědčením, které ředitel vloží rovnou do šablonového výkazu.

### Kdo v Česku dělá totéž (a jak)

| Poskytovatel | Model | Cena | Osvědčení za záznam? |
|---|---|---|---|
| **Eduall** | „Netflix" model: 215+ záznamů s osvědčením, roční členství jednotlivce i sborovny | 1 490–2 490 Kč/rok za učitele, sborovna od 15 000 Kč | **ano** |
| **Učitelnice.cz** | webináře zdarma, osvědčení i ze záznamu po dotazníku | 0 Kč | **ano** |
| **NPI ČR / SYPO** | živé webináře zdarma, záznamy na YouTube (112+ témat) | 0 Kč | jen za živou účast (min. 45 min) |
| **Tvořivá škola** | placené webináře, záznam automaticky účastníkům | 590–1 190 Kč/osoba | ne, jen účastníci |
| **RAABE** | placené online kurzy, bezplatné záznamy | kurzy placené | **výslovně ne** za zpětné zhlédnutí |
| **Zřetel** | DVPP online webináře, osvědčení e-mailem | placené | ne |
| **Včelka** | webináře zdarma + akreditované semináře, záznamy | 0 Kč / placené | ne |
| **Učíme společně, Online sborovna** | klub s předplatným, členská sekce 24/7, osvědčení každé pololetí (16 h/rok), 2 setkání naživo, 20% sleva | **6 000 Kč/rok** za člena | ano, z klubu |
| **Inovativní učitel, Inovativní sborovna** | roční členství pro školu | placené | ano |
| **EDUkační laboratoř** | „Formativní hodnocení (sborovna)" pro celé sbory | placené | ano |
| **Fraus** | produktové i didaktické webináře | 490 Kč/webinář | jen živě |
| **Nová škola, Taktik, Didaktis** | produktové webináře zdarma | 0 Kč | jen živě |

Co z tabulky plyne: model „knihovna záznamů s osvědčením" už v Česku existuje dvakrát. **Eduall** ho prodává (215+ záznamů, sborovna od 15 000 Kč ročně) a **Učitelnice** ho dává zdarma, ale bez práce se sborovnou a bez předmětové hloubky pro ZŠ. Placené kluby (Učíme společně, Inovativní sborovna) dokazují, že sborovny za členství platí, když dostanou vykazatelné hodiny. NPI dokazuje, že zdarma přitáhne desítky tisíc. **Nikdo ale nekombinuje tři věci najednou: zdarma, osvědčení ze záznamu po ověření znalostí a odemknutí pro celou sborovnu.** To je naše pozice. Ochrana proti kopírování není mechanika (tu okopíruje Eduall za měsíc), ale obsah: 100+ záznamů o předmětové didaktice ZŠ, lektoři, kteří sami učí, a zákaznická báze 600 škol, kterým do knihovny stačí jeden klik.

### Proč učitelé chodí (a proč ne)

- Poptávka roste po tématech **duševní zdraví a wellbeing, třídnické hodiny, digitální kompetence a AI** (KCV, ohlédnutí za DVPP 2025/26). Naše řady mají silnou předmětovou didaktiku, AI a ŠVP; wellbeing a třídnictví chybí a jsou kandidáti na hlasování.
- Hlavní praktický důvod účasti je **osvědčení pro ředitele a šablony** plus úspora času a cesty. TALIS 2024: pro 63 % českých učitelů je největší bariérou DVPP nedostatek času, podíl učitelů s digitálním DVPP vzrostl ze 41 % na 77 %. Český průzkum motivace k webinářům neexistuje; naše zkušenost říká, že pozvánka bez zmínky o certifikátu konvertuje hůř.
- Typický no-show u bezplatných webinářů je 40–60 % registrovaných, takže záznam s certifikátem zachytí polovinu lidí, kteří naživo nepřišli. To je samo o sobě argument pro knihovnu.

### BOZP jako benefit pro školy

- Periodicitu školení BOZP zákon nestanoví, určuje ji zaměstnavatel (praxe 1–2 roky); školení PO má lhůtu **2 roky pro zaměstnance a 3 roky pro vedoucí** (vyhláška 246/2001 Sb., § 23). E-learningová forma je běžně přijímaná pro pedagogické a administrativní pozice, ne pro rizikové provozy (dílny, laboratoře).
- Ceny e-kurzů na trhu: **od 28 Kč do 200 Kč na osobu**, škola se 100 zaměstnanci platí kolem 18 000 Kč ročně za online školení s certifikátem (BOZP.cz, BOZP-consult, Proškolen.cz).
- Pro Vividbooks to znamená: BOZP v ceně sborovny je hmatatelná úspora 5 000–15 000 Kč na školu a jednoduchá věta pro ředitele. Obsah ale musí garantovat **odborně způsobilá osoba v prevenci rizik** a osvědčení musí mít náležitosti podle zákoníku práce. Nejrychlejší cesta je partnerství s existujícím poskytovatelem (white-label e-kurz, cena 20–30 Kč/osoba při objemu), ne vlastní vývoj. Rozhodnout do konce října, spustit s lednovým výročím školení.

### Zdroje k této kapitole

ČSÚ: csu.gov.cz/materske-zakladni-a-stredni-skoly · ČTK/České noviny 2561092 · MŠMT, Mimořádné šetření učitelé 2025 (edu.gov.cz) · ČŠI v Řízení školy, Malotřídní ZŠ · MŠMT, Informace k novele zákona o pedagogických pracovnících · zakonyprolidi.cz/cs/2005-317 · opjak.cz, výzva 02_24_034 · tvorivaskola.cz/cenik · ucimespolecne.cz/ucitelsky-klub · raabe.cz/webinare · npi.cz/vzdelavani/21-webinare · kcv.cz, Ohlédnutí za DVPP 2025/26 · skolenibozp.cz/cenik · bozp-consult.cz. Část stránek (msmt.gov.cz, data.gov.cz, uoou.gov.cz, vividbooks.com) byla z tohoto prostředí nedostupná, čísla z nich jsou převzata z výtahů vyhledávače a je dobré je před tiskem ověřit.


## 3 · Produktová teze: „DVPP zdarma je Netflix pro sborovny"

### Co to je jednou větou

Knihovna webinářů, ke kterým si učitel po zhlédnutí vystaví certifikát DVPP, plus mini-aplikace do hodiny a hlasování o dalších tématech. Zdarma pro celou sborovnu, když se do ní škola „přihlásí jako celek".

### Proč Netflix a ne „archiv webinářů"

Archiv je seznam. Netflix je **katalog, který ti vybírá**. Rozdíl je v pěti věcech, které lze na stávajícím webu postavit bez nové technologie:

| Prvek Netflixu | Překlad pro DVPP zdarma | Co to udělá s čísly |
|---|---|---|
| Řady (series) | **Řady po předmětu a stupni**: „Jak nadchnout žáky pro fyziku" (5 dílů), „AI pro pedagogy" (3 díly), „ŠVP krok za krokem" (4 díly) | Učitel se vrací, ne jen registruje. Zvedá počet zhlédnutí na kontakt. |
| Upoutávka (trailer) | **90s sestřih** každého záznamu: nejlepší moment + co si odnesu + „certifikát po zhlédnutí". Běží bez registrace. | Upoutávka je sdílitelná do FB skupin a Messengeru → nový návštěvník přichází s jasnou představou. |
| „Pokračovat ve sledování" | Osobní řádek na úvodu: rozkoukané záznamy, certifikáty k dokončení | Vrací učitele k nedokončenému → certifikát → důvod pozvat kolegu. |
| Doporučeno pro vás | Řádek podle předmětu a stupně z dotazníku (už dnes máme `subject_interest_scores`) | Personalizovaný newsletter „Nové ve vaší řadě". |
| Top 10 tento týden | Nejsledovanější záznamy + hlasování „co natočit příště" | Sociální důkaz + zapojení. |

Pravidlo obsahu zůstává stejné jako u zářijové série: **hook je vždy o předmětu a dětech, Vividbooks je odpověď, ne téma.** Díky tomu funguje knihovna i pro učitele, kteří Vividbooks vůbec neznají. To je klíč k tomu, aby lead magnet přitáhl lidi mimo bázi.

### Tři vrstvy obsahu

1. **Živý webinář** (jako dnes) – zdarma, otevřený, certifikát za účast. Živý webinář je akviziční událost: sbírá registrace, vytváří termín, kolem kterého se dá zvát kolegy.
2. **Záznam v knihovně** – dostupný po přihlášení do DVPP zdarma. Certifikát po zhlédnutí vydává systém až po krátkém ověřovacím kvízu (3–5 otázek, které už dnes existují jako `postWebinarQuizQuestions`). Ověřovací kvíz je to, co dělá z „koukal jsem na video" legitimní DVPP.
3. **Bonusová vrstva** – mini-aplikace (rýsování, 3D modely, periodická tabulka, Početníček, minihry, písanka online), pracovní listy k webináři, hlasování, později BOZP e-learning. Bonusová vrstva je vidět v katalogu pro všechny, ale otevře se jen členům.

### Certifikát jako hlavní měna

Certifikát DVPP je pro učitele praktický důvod, proč se přihlásit: dokládá plnění povinnosti dalšího vzdělávání a ředitel ho chce vidět v portfoliu. V knihovně proto certifikát:

- vzniká automaticky po ověřovacím kvízu, PDF s číslem, jménem, tématem, rozsahem hodin (repo už má generátor certifikátu z 2. 9. 2026),
- ukládá se na **osobní polici certifikátů** v účtu (učitel se vrací, aby si je stáhl pro ředitele),
- má **školní přehled** pro ředitele: kolik hodin DVPP sborovna za rok nasbírala. To je argument, proč ředitel pošle odkaz celé sborovně sám.

### Hlasování a komunita

Každý záznam má tlačítko „Chci pokračování". Sekce „Natočíme příště" ukazuje 6 kandidátských témat, hlasovat může jen člen. Vítězné téma se vysílá do 4 týdnů. Hlasování je levný způsob, jak (a) zjistit zájmy kontaktu a (b) dát mu důvod se vrátit. Komunitu (setkání, skupina) zatím neřešíme; hlasování ji připravuje.



## 4 · Přístupový model: platit, nebo pozvat?

### Tři varianty na stole

| | A · Předplatné školy | B · Pozvi kolegy | C · Sborovna s milníky (doporučeno) |
|---|---|---|---|
| Cena | 450 Kč/rok za školu (nebo měsíčně) | 0 Kč, podmínka: 20 potvrzených kolegů | 0 Kč při milníku sborovny; 990 Kč/rok pro školu, která zvát nechce |
| Co to dělá s bází | Nic. Platba nezvětšuje databázi. | Maximální tlak na růst, ale 20 je pro většinu ZŠ nedosažitelné | Růst báze + záchytná síť pro malé školy |
| Riziko | 450 Kč je pro školu triviální částka, ale **administrativně drahá** (objednávka, faktura, schválení). Platba zabije impuls. | Vysoký práh → frustrace; tvrdá brána je „dark pattern" | Složitější komunikace |
| Příjem | 4 200 škol × 450 = 1,9 mil. Kč/rok teoretického maxima, reálně zlomek | 0 | Malý, není cílem |

### Doporučení: sborovna s milníky podle velikosti školy

Cíl projektu je báze, ne příjem. Platba proto musí být **výjimkou, ne cestou**: nabízíme ji jen škole, která zvát nechce, a naceníme ji tak, aby pozvání bylo vždy jednodušší. Měsíční platba u školy nefunguje vůbec (fakturace, schvalování); pokud platba zůstane, tak roční.

**Proč ne fixních 20.** Benchmarky referral programů jsou jednoznačné: první milník má být 1–3 doporučení, „nastav první tier příliš vysoko a většina advokátů se zasekne, než cokoli získá". Harry's mělo 100 000 e-mailů a jen ~200 lidí dosáhlo tieru 50; průměrný doporučovatel pozve 2,7 lidí. Průměrná úplná ZŠ má 20–30 pedagogů, malotřídky 4–10. V naší bázi má dnes 20 a více kontaktů **32 škol**. Fixních 20 je tedy cíl pro promile učitelů. Navržené pravidlo:

| Velikost sboru (z rejstříku / statistiky MŠMT) | Milník pro sborovnu zdarma | Odpovídá cca |
|---|---|---|
| do 10 pedagogů | 4 potvrzení kolegové | 40–50 % sboru |
| 11–25 | 8 | ~35 % |
| 26–50 | 12 | ~30 % |
| 51+ | 16 | ~25 % |

Navenek komunikujeme jednoduše: **„Pozvěte kolegy. Když se přidá třetina sborovny, mají záznamy zdarma všichni ve škole."** Konkrétní číslo ukáže dashboard.

**Odměňujeme i cestou** (milníková škála jako Morning Brew, odměna obsahem, ne hrnkem):

- **1 potvrzený kolega** → zvoucí získává celý školní rok záznamů (dnes má jen jednotlivé záznamy za e-mail).
- **3 potvrzení** → bonusový webinář „jen pro sborovny" + hlasovací právo o dalších tématech.
- **Milník sborovny** → záznamy zdarma pro **všechny učitele školy** včetně těch, kteří se ještě nepřihlásili, školní přehled certifikátů pro ředitele, BOZP balíček (až bude).
- **Celá sborovna** (90 %+) → odznak „Sborovna roku", tištěné materiály zdarma, certifikát „Vividbooks Champion" pro zakladatele (rozsah 8 hodin, model Edpuzzle Coach / Kahoot Certified).

**Pozvaný kolega dostane něco hned:** první záznam a certifikát bez čekání. Jednostranné programy nekonvertují.

### Udržení a odhlášení

Členství sborovny platí, dokud počet **aktivních odběratelů** ze školy neklesne pod milník. Odhlášení jednoho člověka nezruší celou školu okamžitě: zakladatel dostane upozornění „chybí vám 1 kolega, máte 30 dní" a nabídku pozvat dalšího. Okamžité vypnutí školy po jednom odhlášení by vyvolalo tlak na kolegu, aby se neodhlašoval, a to je přesně to, co ÚOOÚ nechce vidět.

### Realistická matematika (proč referral sám nestačí)

Konzervativní model z benchmarků newsletterových programů: 24 400 aktivních × 10 % sdílí × 2,7 pozvaných × 30 % potvrdí ≈ **2 000 nových na jeden cyklus** (K ≈ 0,08). S referral blokem v každém týdenním digestu a hustou sítí sborovny (sekundární vlna bude vyšší než obvyklých 21 %) je za 4 měsíce reálných **+6 000 až +10 000 z referralu**. Zbytek musí přijít z živých webinářů (dnes ~175 denně v září), z ředitelů (jeden ředitel = celý sbor naráz), z upoutávek v učitelských skupinách a z placené Meta kampaně optimalizované na potvrzený kontakt. Kapitola 10 to rozkládá po fázích.



## 5 · Referral mechanika do detailu (právně bezpečná verze)

### Právní rámec, který určuje design

Stanovisko WP29 5/2009 a evropská praxe (rozsudek BGH I ZR 208/12) říkají: pozvánka „pošli kolegovi" **není** obchodní sdělení jen tehdy, když za ni není pobídka, odesílatel vidí celý obsah, příjemce vidí, kdo ho zve, a adresa se po doručení neukládá. **Jakmile za zadání cizího e-mailu slibujeme odměnu, je to naše obchodní sdělení bez souhlasu příjemce** (zákon 480/2004 Sb., pokuta až 10 mil. Kč, a hlavně reputace v malé komunitě učitelů). Proto:

1. **Hlavní cesta je sdílení odkazu učitelem samotným.** Osobní odkaz `dvppzdarma.cz/s/{kod}`, předpřipravená zpráva do WhatsAppu, Messengeru, školního Teamsu nebo e-mailu, který odejde z jeho vlastní schránky, plus letáček s QR kódem na nástěnku ve sborovně. E-maily kolegů nikdy nevidíme, dokud se sami nepřihlásí.
2. **Školní kód přes ředitele** (model Kahoot „universal license key"). Ředitel je oprávněn informovat sbor interně; rozešle kód sborovně sám. Legálně nejčistší způsob, jak dostat celou školu naráz.
3. **Formulář „vzkaz kolegovi"** jen v režimu WP29: jedna zpráva bez marketingového obsahu, jménem odesílatele, bez připomínky, adresa se po 14 dnech bez reakce maže, a **odměna se nikdy neváže na odeslání**, jen na to, že se kolega sám přihlásí a potvrdí. Před spuštěním hodina s právníkem.
4. Do milníku se počítá výhradně **potvrzený (double opt-in) a aktivovaný** kolega (přehrál si aspoň 3 minuty nebo vystavil certifikát), ne zadaná adresa. To řeší falešné e-maily a self-referral zároveň.

### Role

- **Zakladatel sborovny** (první učitel ze školy, který klikne „Založit sborovnu"). Vidí dashboard, sdílí kód, sleduje milník.
- **Kolega** – přijde přes odkaz/kód, přihlásí se e-mailem, potvrdí, vyplní 3 otázky. Teprve potvrzený a aktivovaný se počítá.
- **Ředitel / zástupce** – zvláštní role: dostane školní kód a stránku s výkazem DVPP sboru. V bázi máme 1 496 ředitelů a 857 zástupců.

### Flow krok za krokem

1. Učitel se na DVPP zdarma přihlásí e-mailem (magic link, žádné heslo). Při prvním přihlášení vybere školu z našeptávače nad rejstříkem (RED_IZO); školní doména se předvyplní sama.
2. Dashboard: **„Vaše sborovna ZŠ Milovice: 3 z 8. Až se přidá 5 kolegů, mají záznamy zdarma všichni ve škole."** Progress bar započítává i kolegy, kteří už v naší bázi jsou a školu si přiřadí. Cíl je tak blíž, než vypadá, a učitel to vidí hned.
3. Sdílení: kopírovat odkaz, poslat do WhatsAppu/Messengeru, stáhnout letáček A4 s QR, poslat řediteli žádost o školní kód (e-mail píše učitel, my jen předvyplníme text).
4. Kolega klikne, přihlásí se, potvrdí, odpoví na 3 otázky (předmět, stupeň, pozice), a hned dostane první záznam. Souhlas s newsletterem je součástí potvrzení (double opt-in existuje).
5. Dashboard se aktualizuje, zakladatel dostane „Přibyl vám kolega", při milníku slavnostní e-mail celé sborovně.

### Anti-fraud

- Jedna škola na kontakt. Školní doména se páruje s RED_IZO automaticky; u freemailů (polovina báze) je povinný výběr školy z našeptávače.
- Jednorázové domény a `+alias` triky se nepočítají. Stejný prohlížeč/IP pro zvoucího i pozvaného během hodiny jde do fronty k ruční kontrole v adminu (`/marketing/sborovny`).
- Odměna má stav „čeká" do aktivace kolegy, ne do kliknutí na potvrzení.
- Denní přepočet sboroven z aktivních odběratelů, ochranná lhůta 30 dní.

### Co vidí ředitel

Stránka „Pro ředitele": školní kód a hotový text pro sborovnu, přehled kolik učitelů má kolik hodin DVPP, souhrnný výkaz ke stažení pro výroční zprávu a ČŠI, nabídka BOZP. Ředitel, který rozešle kód, dostane sborovnu odemčenou okamžitě bez milníku: je to výměna za to, že nám otevřel dveře do celé školy.



## 6 · Databáze škol: jeden řádek na každou ZŠ v republice

### Co má databáze umět odpovědět

Pro každou základní školu v ČR chceme na jednom řádku vidět: **Jsme tam? Kolik lidí ze sboru máme? Kdo je první kontakt? Kdo je ředitel a jak se mu ozvat? Jak je škola velká? Jaký je obchodní stav? Proč tam nejsme?** Dnes odpovíme jen na obchodní stav, a to jen dotazem do Pipedrive.

### Zdroje dat

| Zdroj | Co dá | Jak často |
|---|---|---|
| **Rejstřík škol a školských zařízení** (MŠMT, otevřená data na data.gov.cz, export XLS z `isv.gov.cz/rssz`) | RED_IZO, IZO, název, adresa, zřizovatel, ředitel, e-mail, telefon, web, druh školy, kapacita | čtvrtletně |
| **Statistická ročenka školství / výkazy M 3** (statis.msmt.gov.cz) | počet žáků a tříd na školu, přepočtený počet učitelů | ročně (podzim) |
| **Naše báze `subscribers`** | kontakty, pozice, zájmy, aktivita, doména e-mailu | živě |
| **Pipedrive** | organizace, obchodník, stav dealů, produkty | denně (sync do `schools.pipedrive_status`) |
| **Objednávky a licence** (`orders`, kódy škol z api.vividbooks.com) | zákazník ano/ne, předměty, licence do kdy | denně |
| **`funnel_events`** | první návštěva, první certifikát, milník sborovny | živě |

Pokud výkaz M 3 na úrovni školy nebude dostupný, počet pedagogů se odhadne z kapacity a počtu tříd (cca 1 učitel na 11–12 žáků na ZŠ, s přirážkou u úplných škol). Milník sborovny se z odhadu spočítá stejně dobře, přesnost na jednotky učitelů není potřeba.

### Stav školy (jedno pole, které řídí komunikaci)

| Stav | Definice | Co s ní děláme |
|---|---|---|
| **Zákazník** | aktivní licence | sborovna zdarma automaticky, cíl: doplnit zbytek sboru do báze |
| **Sborovna** | milník splněn | udržet, ředitelský výkaz, BOZP, „sborovna roku" |
| **Rozjetá** | 3+ aktivní kontakty, milník nesplněn | e-maily zakladateli, letáček do sborovny |
| **Stopa** | 1–2 kontakty | „pozvěte kolegu", nabídka založit sborovnu |
| **Bílé místo** | 0 kontaktů | osobní e-mail řediteli, dopis, ambasador z okolí |
| **Ztracená** | měli jsme kontakty, všechny odhlášené / vyčištěné | dopis řediteli za 6 měsíců, jiný lektor, jiné téma |

Ke stavu se ukládá **důvod** (výběr + poznámka), když se ho obchodník nebo my dozvíme: „používají konkurenci X", „nemají rozpočet", „ředitel nechce online DVPP", „malotřídka bez 2. stupně", „nedostupný e-mail". Tím vzniká to, co Vítek popisuje jako „důvody, proč tam nejsme", a zároveň podklad pro produkt.

### Pokrytí a mapa

Metrika **pokrytí sboru** = aktivní kontakty se školou / počet pedagogů. Dashboard ji ukáže jako mapu okresů (medián pokrytí) a jako tabulku škol seřazenou podle velikosti × pokrytí, aby se obchod i marketing soustředili na velké školy s malým pokrytím (největší potenciál na jeden e-mail řediteli).

### Zpětné dopárování stávající báze

11 989 kontaktů má školní doménu. Postup: (1) z rejstříku vzít web školy a e-mail ředitele, odvodit doménu; (2) spárovat s doménami v `subscribers`; (3) u nespárovaných 1 000+ domén použít ruční kontrolu v adminu s našeptávačem; (4) freemailové kontakty (12 400) dostanou v prvním e-mailu knihovny otázku „Kde učíte?" s našeptávačem a odměnou (30 dní záznamů). Odhad: do konce září budeme znát školu u 60 % aktivní báze.


## 7 · Funnel a poznávání kontaktu

### Fáze funnelu a co se v nich sbírá

| Fáze | Vstup | Co sbíráme | Mechanika |
|---|---|---|---|
| **Návštěva** | FB skupina, upoutávka, e-mail, hledání „DVPP zdarma" | nic (pixel, UTM) | Landing s upoutávkami, bez brány |
| **Lead** | klik „Chci certifikát" / „Pustit záznam" | e-mail | Magic link, 1 pole |
| **Potvrzení** | klik v e-mailu | souhlas, `consent_version` | double opt-in (už existuje) |
| **Profil** | první přihlášení | škola, předmět, stupeň, pozice | 4 otázky, progress bar, odměna: „doporučeno pro vás" |
| **Aktivace** | zhlédne 1 záznam do konce + kvíz | zájmy z chování | první certifikát → moment na pozvání |
| **Pozvání** | dashboard sborovny | kolegové | referral flow |
| **Zákazník** | trial / objednávka | | stávající obchodní proces (Pipedrive) |

### Vstupní kvíz „Jaký jste učitel?"

Místo suchého formuláře 8 otázek v hravé podobě (každá jedna obrazovka, ilustrace, 40 s celkem). Výsledkem je **typ učitele** (např. „Badatel", „Trenér", „Vypravěč", „Architekt"), sdílitelná kartička a doporučené 3 záznamy. Otázky sbírají to, co potřebujeme:

1. Kde učíte? (našeptávač škol) → RED_IZO
2. Co učíte? (multi) → předměty
3. Který stupeň? → 1./2. stupeň
4. Jaká je vaše role? (učitel / ředitel / zástupce / asistent / metodik / student) → pozice
5. Kolik hodin DVPP potřebujete letos doložit? (0 / do 8 / 8–16 / více) → intent
6. Co vás teď nejvíc pálí? (motivace žáků / diferenciace / AI / ŠVP / hodnocení / interaktivní tabule) → téma
7. Používáte Vividbooks? (ne / zkouším / ano) → `usesVividbooks`
8. Kdo ve škole rozhoduje o DVPP a učebnicích? (já / ředitel / předmětová komise) → obchodní signál

Odpovědi jdou do `subscribers.merge_fields` + `subject_interest_scores`, typ učitele jako tag. Kvíz je opakovatelný jednou za rok („aktualizujte profil, dostanete nový výběr").

### Progressive profiling

Nikdy se neptáme na všechno najednou. Každá další interakce doplní jeden údaj: po prvním certifikátu „chcete dostávat jen témata pro váš předmět?", po hlasování „jaký formát preferujete: 45 min / 90 min?", po 3 zhlédnutích „jaké učebnice používáte?". Vždy s viditelným užitkem pro učitele.

### E-mailové sekvence (automatizace v našem nástroji)

Spouštěče už existují: `subscriber_created`, `webinar_registered`, `trial_activated`. Přidáme `referral_confirmed`, `certificate_issued`, `milestone_reached`.

1. **Uvítání (D0–D7):** potvrzení → „Váš první certifikát za 45 minut" → připomínka nedokončeného záznamu → „Pozvěte kolegu, získáte celý rok".
2. **Po certifikátu (D0–D3):** certifikát v PDF → „Kolegům se bude hodit" + předvyplněná pozvánka → tip na další díl řady.
3. **Sborovna (průběžně):** přibyl kolega / chybí 2 do milníku / milník splněn / hrozí ztráta (30 dní).
4. **Týdenní digest „Nové v knihovně"** – personalizovaný podle předmětu, vždy 1 upoutávka, 1 hlasování, 1 termín živého webináře.
5. **Ředitelská sekvence** (jen pozice ředitel/zástupce): přehled DVPP sboru, BOZP nabídka, jak pozvat celý sbor jedním kliknutím.



## 8 · Kanály: jak dostat DVPP zdarma do každé ZŠ

Každý kanál má vlastní úlohu ve funnelu a vlastní číslo, které sledujeme. Pořadí odpovídá očekávanému příspěvku k cíli.

### 8.1 Vlastní báze (největší páka, nulové náklady)

24 400 aktivních odběratelů, z nichž 20 % otevírá. Tři vlny:

1. **Re-aktivace chladných** (21 776 kontaktů s tagem „Chladný"): před spuštěním knihovny 2 e-maily „Vaše certifikáty DVPP zdarma, nově na jednom místě" s jediným CTA (přihlásit se, vybrat školu). Kdo neotevře ani jeden, dostane ještě jeden re-permission e-mail a pak vypadne z hromadných rozesílek. Chrání to reputaci domény u Seznamu, kde má polovina učitelů soukromé schránky.
2. **Týdenní digest „Nové v knihovně"** pro aktivní: 1 upoutávka, 1 hlasování, 1 termín, stálý blok „Vaše sborovna: X z N". Referral blok v každém vydání je to, co dělá Morning Brew; jednorázová kampaň „pozvěte kolegy" nemá dost cyklů.
3. **Segmentované sekvence** podle pozice (ředitel), předmětu a fáze funnelu (kapitola 7).

Sledujeme: otevřenost 30 dní (cíl 35 %), přihlášení do knihovny (cíl 8 000 do konce října), podíl s přiřazenou školou.

### 8.2 Živé webináře (stávající motor, ~175 kontaktů denně v září)

Nic neměníme na hooku („o předmětu a dětech"), měníme, co následuje: den po webináři přijde místo jednoho „záznam + ukázka" e-mailu sekvence knihovna → certifikát → sborovna. Každý živý webinář dostane **„Přiveďte kolegu naživo"**: kdo přijde s kolegou ze stejné školy, má rovnou rok záznamů. Do listopadu jeden webinář měsíčně na téma vítězné v hlasování.

Sledujeme: registrace/webinář, podíl registrací se školou, podíl „přišel s kolegou".

### 8.3 Ředitelé a zástupci (2 353 v bázi + rejstřík)

Ředitel je jediný člověk, který dostane do knihovny celý sbor jedním e-mailem, a je to legálně čistá cesta. Tři dotyky:

1. **Osobní e-mail** (z adresy Vítka, ne z news@): „Ve vaší škole už má DVPP zdarma 6 učitelů. Tady je školní kód pro zbytek sboru." Personalizace z našich dat, výkaz DVPP pro výroční zprávu, BOZP jako bonus. Odesílat po 200–300 denně, odpovědi řeší obchod.
2. **Dopis** (Obchodní psaní České pošty, odhad 15–25 Kč/ks včetně tisku) 1 500 největším školám bez sborovny: A4 se školním kódem a QR + letáček do sborovny. Benchmark odezvy B2B direct mailu 2–4 %, u škol s předchozím kontaktem 5–9 %. Očekávání: 100–200 škol s odemčenou sborovnou z dopisu.
3. **Datová schránka** jako test na 200 školách: nulové náklady, vysoká otevřenost, riziko vnímání jako spam v úředním kanálu. Vyhodnotit po 2 týdnech proti dopisu.

Sledujeme: školní kódy rozeslané ředitelem, sborovny odemčené ředitelem, odezva na dopis (unikátní QR).

### 8.4 Učitelské skupiny na Facebooku a upoutávky

Učitelé+ (Učitelská platforma, uváděno přes 40 000 členů), skupiny Pedagogické komory (souhrnně ~40 000, včetně oborových „Učitelé fyziky sobě", „Učitelky 1. stupně ZŠ sobě"), GEG Učte s námi. Skupiny mají pravidla proti reklamě, takže **postujeme obsah, ne nabídku**: 45–60s upoutávku s jedním konkrétním tipem do hodiny, ideálně z profilu lektora nebo učitele-ambasadora, ne z firemní stránky. Odkaz vede na veřejnou část záznamu (prvních 10 minut bez brány), teprve pak přihlášení. Wistia data: brána v 10–20 % délky videa konvertuje 43 %, brána před videem 16 %.

Sledujeme: návštěvy z FB (UTM), lead rate landing (cíl 10–18 % u warm, 6–8 % u cold).

### 8.5 Placená Meta kampaň (jediný placený kanál)

Až po nasazení Conversions API a po týdnu dat. Optimalizace na událost **„potvrzený kontakt"** (double opt-in), ne na formulář; Meta potřebuje 50+ událostí týdně, což při 200 potvrzeních denně splníme první den. Kreativa = upoutávky ze záznamů (MasterClass model: trailer s lektorem, ne reklama). Publika: lookalike z potvrzených se školou, retargeting návštěvníků knihovny, vyloučit aktivní odběratele. Rozpočet: 30 000 Kč/měsíc test v říjnu, škálovat, když cena za potvrzený kontakt zůstane pod 40 Kč.

Sledujeme: cena za potvrzený kontakt, podíl s přiřazenou školou, aktivace do 14 dnů.

### 8.6 Ambasadoři (příprava na 2027)

Zakladatelé sboroven, kteří dosáhli milníku, dostanou pozvání do programu „Vividbooks Champion": certifikát 8 hodin DVPP za proškolení sboru (model Edpuzzle Coach, Quizizz Super Trainer, Kahoot Certified), včasný přístup k novým záznamům, viditelnost v katalogu („doporučuje Jana N., ZŠ Milovice"). Ambasador je zároveň ten, kdo postuje upoutávky ve skupinách. V prosinci vybrat prvních 30.

### 8.7 Kanály, které vědomě neděláme

Google Ads na „DVPP zdarma" (malý objem hledání, drahé kliky), tištěná inzerce v Učitelských novinách, konference (mimo sezónu). Vrátit se k nim až s daty z Meta.


## 9 · Měření: KPI strom a instrumentace

### Severní hvězda

**Počet aktivních odběratelů se školou** (status `subscribed` + přiřazené RED_IZO + otevřel e-mail nebo web za 90 dní). Ne hrubý počet kontaktů: 30 000 kontaktů, z nichž otevírá 5 000, není báze, je to seznam.

### Strom metrik

```
Aktivní odběratelé se školou (cíl: 48 000 k 31. 12. 2026, z toho 30 000 aktivních)
├─ Noví potvrzení odběratelé / týden
│   ├─ z referralu (pozvánky odeslané → potvrzené)      cíl 45 % nových
│   ├─ z živých webinářů                                 cíl 30 %
│   ├─ z upoutávek / FB skupin / organiky                cíl 20 %
│   └─ z ředitelů (hromadné pozvánky)                    cíl 5 %
├─ Konverze funnelu
│   ├─ návštěva → lead (e-mail)                          benchmark 8–15 %
│   ├─ lead → potvrzení (double opt-in)                  cíl > 70 %
│   ├─ potvrzení → profil dokončen                       cíl > 60 %
│   ├─ profil → 1. certifikát do 14 dnů                  cíl > 35 %
│   └─ 1. certifikát → odeslal aspoň 1 pozvánku          cíl > 25 %
├─ Referral
│   ├─ pozvánky / zvoucí (průměr)                        cíl 6
│   ├─ přijetí pozvánky                                  cíl 30–40 %
│   └─ K-faktor = zvoucí % × pozvánky × přijetí          cíl > 0,5
├─ Školy
│   ├─ školy s ≥ 1 aktivním kontaktem                    dnes odhad ~3 000 domén, cíl 4 000 ZŠ
│   ├─ školy s milníkem sborovny                         cíl 600
│   └─ pokrytí sboru (kontakty / pedagogové z rejstříku) medián cíl 25 %
└─ Kvalita báze
    ├─ otevřenost 30 dní                                 cíl > 35 %
    ├─ odhlášení / měsíc                                 strop 0,8 %
    └─ bounce                                            strop 1 %
```

### Instrumentace (co kam poslat)

- **Meta Pixel + Conversions API** (server-side z Edge funkce): `ViewContent` (záznam), `Lead` (e-mail zadán), `CompleteRegistration` (double opt-in potvrzen), `Subscribe` (profil dokončen), vlastní `Certificate`, `InviteSent`, `InviteAccepted`, `SchoolMilestone`. CAPI je nutné: Safari a adblocky na učitelských noteboocích snižují pixel o 30–50 %.
- **GA4** stejné události + `school_id` jako user property (hash RED_IZO), UTM na každém odkazu z mailingu (náš nástroj už přepisuje odkazy na sledovací).
- **Vlastní tabulka `funnel_events`** v Postgresu (jediný zdroj pravdy pro KPI): `event`, `subscriber_id`, `school_id`, `source`, `campaign_id`, `referrer_id`. Pixel i GA jsou pro nákup reklamy, ne pro reporting.
- **Dashboard v adminu** (`/marketing/dvpp`): týdenní kohorty, strom výše, mapa ČR podle okresů s pokrytím škol.

### Rytmus

Týdenní 30min review nad dashboardem: (1) kolik nových potvrzených, (2) odkud, (3) kde funnel padá, (4) jedna změna na příští týden. Bez tohoto rituálu se strategie neuměří.


## 10 · Plán na čtyři měsíce (září–prosinec 2026)

Východisko: 24 400 aktivních odběratelů. Cíl 48 000 k 31. 12. (2×), ambice 72 000 (3×). Pro 2× je potřeba **cca 200 potvrzených kontaktů denně** po 120 dní. Dnes přichází mimo sezónu ~13 denně, v září s webináři ~175 denně.

Upřímný rozklad, odkud těch 24 000 nových má přijít (střední odhad, rozsah v závorce):

| Zdroj | Nových aktivních do 31. 12. | Předpoklad |
|---|---|---|
| Živé webináře (září–prosinec) | 7 000 (5 000–9 000) | 12 webinářů × 600 registrací, 60 % nových |
| Referral přes sborovny | 8 000 (6 000–10 000) | 10 % sdílí, 2,7 pozvaných, 30 % potvrdí, 3–4 cykly, hustá síť sborovny |
| Ředitelé (školní kód, e-mail, dopis) | 5 000 (2 500–8 000) | 250 sboroven odemčených ředitelem × 20 učitelů |
| Upoutávky, FB skupiny, organika | 2 500 (1 500–4 000) | 30 000 návštěv × 8 % lead × 75 % potvrzení… |
| Placená Meta kampaň | 2 000 (1 000–4 000) | 90 000 Kč, 40 Kč za potvrzený kontakt |
| **Celkem** | **24 500 (16 000–35 000)** | 2× je dosažitelné, 3× vyžaduje horní hranici všeho |

Kontext, který je třeba říct nahlas: na ZŠ v ČR je zhruba 77 000 přepočtených učitelských úvazků (fyzických osob odhadem 85–95 tisíc). Cíl 72 000 aktivních by znamenal mít v bázi téměř každého učitele ZŠ. 3× je tedy hranice trhu, ne marketingový cíl; pro rok 2027 dává větší smysl měřit **pokrytí škol a sboroven** než počet e-mailů.

### Fáze 0 · Základy (1.–21. září) – „neztratit zářijovou vlnu"

Zářijová série webinářů běží a přivádí nejvíc kontaktů v roce. Tři rychlé věci, které tu vlnu zachytí, ještě než bude knihovna hotová:

- **Registrace na webinář vybírá školu z rejstříku** (RED_IZO). Jediné nové pole, ale bez něj neumíme počítat sborovny.
- **Po každém webináři e-mail „Pozvěte kolegu na další díl"** s osobním odkazem a počitadlem, ručně sledované v tabulce. Měří, jestli učitelé zvou, ještě než stavíme dashboard.
- **Pixel + CAPI + `funnel_events`** nasazené na registraci a certifikát. Ať máme baseline před spuštěním.
- Import rejstříku škol do tabulky `schools`, párování stávajících 3 900 domén na RED_IZO, první verze mapy pokrytí.

Milník 21. 9.: víme, ve kterých ZŠ máme kolik lidí, a máme týdenní baseline funnelu.

### Fáze 1 · Knihovna a sborovny (22. září – 26. října) – „Netflix se otevírá"

- Nová landing DVPP zdarma: hero s upoutávkou, katalog řad, „Top 10", sekce Pro ředitele.
- Přihlášení magic linkem, profil (kvíz Jaký jste učitel), police certifikátů, ověřovací kvíz u záznamů.
- Sborovna: dashboard, pozvánky e-mailem i odkazem, milníky podle velikosti, e-mailové sekvence.
- 20 nejlepších záznamů z historie sestříhaných s upoutávkami (2–3 týdny práce střihače; ostatní záznamy doplňovat průběžně po 5 týdně).
- Soft launch na 2 000 nejaktivnějších kontaktů (otevřeli v posledních 30 dnech), sledovat K-faktor týden.
- Plný launch celé bázi 20. 10. + spuštění hlasování o listopadovém tématu.

Milník 26. 10.: 30 000 aktivních, 150 škol s milníkem sborovny, K-faktor změřený.

### Fáze 2 · Ředitelé a školy, kde nejsme (27. října – 30. listopadu) – „do každé školy"

- Segment škol z rejstříku, kde nemáme ani jeden kontakt (odhad 1 000–1 300 ZŠ) a škol s 1–2 kontakty.
- **Osobní e-mail řediteli** (adresa z rejstříku): DVPP zdarma pro celý sbor + BOZP + výkaz pro výroční zprávu. Sekvence 3 e-mailů, odesílané po 300 denně z vlastní domény, aby nespadla reputace.
- **Dopis** 500 největším školám bez kontaktu (A4 + letáček do sborovny s QR). Sleduje se přes unikátní URL/QR na škole.
- Kampaň v FB skupinách učitelů: upoutávky, „sborovna roku", výsledky hlasování.
- Listopadový živý webinář na vítězné téma z hlasování + 2 předmětové.

Milník 30. 11.: 40 000 aktivních, 3 500 ZŠ s aspoň jedním kontaktem, 400 sboroven s milníkem.

### Fáze 3 · Dotažení a udržení (1.–31. prosince) – „certifikáty před koncem roku"

- Prosinec je měsíc, kdy ředitelé uzavírají DVPP za kalendářní rok. Kampaň „Doložte hodiny DVPP do Vánoc": připomínka nedokončených záznamů, souhrnný výkaz pro ředitele.
- BOZP balíček pro sborovny s milníkem (pokud bude hotový, jinak leden).
- Vyhodnocení: kohorty, K-faktor, náklady na kontakt, rozhodnutí o roce 2027 (komunita, setkání, placená vrstva).

Milník 31. 12.: 48 000 aktivních (2×), z toho 30 000 se školou; 600 sboroven; báze pokrývá 4 000 ZŠ.

### Tým a kapacita

| Role | Úvazek na 4 měsíce | Co dělá |
|---|---|---|
| Vlastník projektu (Vítek) | 30 % | rozhodnutí, obsah, ředitelé |
| Vývojář (web + Edge funkce) | 100 % říjen, 50 % dál | knihovna, sborovny, měření |
| Střihač / video | 50 % | upoutávky, sestřihy, thumbnaily |
| Marketing / mailing | 50 % | sekvence, digest, FB skupiny, dopisy |
| Obchod | průběžně | ředitelé, navazující trialy |



## 11 · Technická implementace (repo `VIVIDBOOKS_WEB_ESHOP`)

Všechno níže sedí na stávající architektuře: React SPA + Edge funkce `make-server-93a20b6f` + Postgres + vlastní mailing. Nový repozitář ani nová služba nejsou potřeba.

### Datový model (nové migrace)

```sql
-- Rejstřík škol jako tabulka místo CSV v paměti
create table schools (
  red_izo text primary key,
  izo text, ico text, name text, type text,           -- ZŠ / MŠ / SŠ / …
  street text, city text, zip text, region text, district text,
  director_name text, email text, phone text, web text,
  founder_type text,                                   -- obec / kraj / soukromá / církevní
  pupils_count int, teachers_count int,                -- z výkazů MŠMT (M 3), doplňuje se ročně
  domain text,                                         -- doména školního e-mailu, pro auto-párování
  pipedrive_status text, pipedrive_synced_at timestamptz,
  first_contact_at timestamptz, milestone_reached_at timestamptz
);

alter table subscribers add column school_red_izo text references schools(red_izo);
alter table subscribers add column teacher_type text;            -- výsledek kvízu
alter table subscribers add column referred_by uuid references subscribers(id);

create table staffrooms (                              -- „sborovna"
  red_izo text primary key references schools(red_izo),
  founder_id uuid references subscribers(id),
  milestone_target int not null,                       -- podle teachers_count
  confirmed_count int default 0,
  status text default 'building',                      -- building / unlocked / grace / expired
  unlocked_at timestamptz, grace_until timestamptz
);

create table referrals (
  id uuid primary key, inviter_id uuid, invitee_email text,
  red_izo text, token text unique,
  status text default 'sent',                          -- sent / reminded / confirmed / expired / bounced
  sent_at timestamptz, reminded_at timestamptz, confirmed_at timestamptz,
  confirmed_subscriber_id uuid
);

create table certificates (
  id uuid primary key, subscriber_id uuid, video_id text, number text unique,
  hours numeric, issued_at timestamptz, pdf_url text
);

create table content_votes (subscriber_id uuid, topic_id text, created_at timestamptz, primary key (subscriber_id, topic_id));

create table funnel_events (
  id bigserial primary key, event text, subscriber_id uuid, red_izo text,
  source text, medium text, campaign text, referrer_id uuid, meta jsonb, created_at timestamptz default now()
);
```

### Endpointy (Edge funkce)

| Metoda | Cesta | Co dělá |
|---|---|---|
| POST | `/dvpp/auth/magic-link` | pošle přihlašovací odkaz (Mandrill), vytvoří `subscribers` řádek jako `pending` |
| GET | `/dvpp/auth/verify?token=` | potvrdí, nastaví cookie session, překlopí na `subscribed` (double opt-in v jednom kroku) |
| GET/PUT | `/dvpp/me` | profil, škola, typ učitele, police certifikátů, rozkoukané záznamy |
| GET | `/dvpp/catalog` | řady, řádky (doporučeno, top 10, pokračovat), upoutávky, stav zámku |
| POST | `/dvpp/progress` | pozice v přehrávači (pro „pokračovat ve sledování") |
| POST | `/dvpp/certificate` | ověřovací kvíz → vystaví certifikát, uloží PDF do Storage, pošle e-mail |
| POST | `/dvpp/staffroom` | založí sborovnu pro RED_IZO, spočítá milník z `teachers_count` |
| POST | `/dvpp/staffroom/invite` | e-maily nebo odkaz, limity, anti-fraud, e-mail pozvánky |
| GET | `/dvpp/staffroom/join?token=` / `/s/{kod}` | potvrzení pozvánky → profil 3 otázky → `confirmed` |
| GET | `/dvpp/staffroom/status` | progress, seznam potvrzených (jen jména), co chybí |
| POST | `/dvpp/vote` | hlasování o tématech |
| POST | `/dvpp/events` | zápis do `funnel_events` + server-side Meta CAPI + GA4 Measurement Protocol |
| POST | `/cron/staffroom-recount` | denně přepočítá `confirmed_count` z aktivních odběratelů, hlídá ochrannou lhůtu |
| GET | `/admin/dvpp/dashboard` | KPI strom, kohorty, mapa pokrytí |
| POST | `/admin/schools/import-registry` | import rejstříku + statistiky MŠMT místo ručního CSV |

### Frontend (nové stránky)

- `dvppzdarma.cz/` – nová landing (hero s upoutávkou, řady, Top 10, Pro ředitele, hlasování, FAQ).
- `/knihovna` (po přihlášení) – řádky jako Netflix, progress, police certifikátů.
- `/zaznam/:slug` – přehrávač s kapitolami, ověřovací kvíz, tlačítko „Pozvat kolegu" po certifikátu.
- `/sborovna` – dashboard, pozvánky, letáček k tisku s QR.
- `/pro-reditele` – hromadná pozvánka, výkaz DVPP sboru, BOZP.
- `/kviz` – „Jaký jste učitel", 8 obrazovek, výsledková kartička.
- Admin: `/marketing/dvpp` (dashboard), `/marketing/sborovny` (fronta k ruční kontrole), rozšíření `/admin/skoly` o velikost a pokrytí.

### Pořadí prací (kritická cesta)

1. Zápis DVPP leadů do `subscribers` + RED_IZO v registraci + `funnel_events` + Meta CAPI. *(týden 1)*
2. Tabulka `schools` z rejstříku + statistik MŠMT, zpětné dopárování 3 900 domén. *(týden 1–2)*
3. Magic link + profil + police certifikátů (přenést existující certifikátový flow na účet). *(týden 2–3)*
4. Sborovna + referral + e-mailové sekvence. *(týden 3–5)*
5. Landing + katalog s řadami a upoutávkami + hlasování. *(týden 4–6)*
6. Pro ředitele + dopisová kampaň + dashboard. *(týden 6–8)*

Redeploy Edge funkce po každé změně serveru, jak stanoví provozní pravidla repa; SEO prerender nové landing přidat do `scripts/seo-pages.mjs`.


## 12 · Rizika a otevřené otázky

| Riziko | Pravděpodobnost | Dopad | Co s tím |
|---|---|---|---|
| Práh pozvánek je moc vysoký, lidé odejdou z flow | vysoká při fixních 20 | vysoký | milníky podle velikosti školy, odměna už za 1. kolegu |
| Pozvánky vnímané jako spam, stížnosti ÚOOÚ | nízká při navrženém designu | vysoký | učitel sdílí sám, školní kód přes ředitele, formulář „vzkaz kolegovi" jen v režimu WP29 bez pobídky za odeslání, mazání nepotvrzených; hodina s právníkem před spuštěním |
| Deliverabilita na seznam.cz při 2× objemu | střední | vysoký | rozehřátí domény, DKIM/DMARC, čištění chladných kontaktů, posílat digest jen otevírajícím |
| Ředitel nebo ČŠI zpochybní osvědčení za záznam | nízká–střední | střední | akreditace už neexistuje, rozhoduje ředitel: uvádět rozsah hodin, lektora, obsah a ověření znalostí podle § 10 vyhl. 317/2005, přestat psát „akreditované" (kap. 2) |
| Střih 100+ záznamů nestíhá | vysoká | střední | začít s 20 nejlepšími, zbytek s automatickými kapitolami z přepisu |
| Kanibalizace: knihovna zdarma sníží zájem o živé webináře | nízká | nízký | živé webináře = nová témata + hlasování; záznam do knihovny až po 14 dnech |
| Odhlášení celé školy kvůli jednomu kolegovi | střední | střední | 30denní ochranná lhůta |
| Malotřídky nikdy nedosáhnou milníku | jistá při fixním prahu | střední | práh 4 pro sbory do 10 |

**Otevřené otázky pro Vítka:**

1. 450 Kč ročně, nebo měsíčně? Doporučuji **nepoužívat platbu jako hlavní cestu vůbec**; pokud zůstane, tak 990 Kč/rok za školu jako „nechci zvát" alternativa. Měsíční platba u školy nefunguje (fakturace).
2. Chceme milníky podle velikosti školy (doporučeno), nebo jeden fixní práh kvůli jednoduchosti komunikace („Pozvěte 10 kolegů")? Kompromis: komunikovat „10 kolegů", ale malé školy mít interně na 4.
3. BOZP: vlastní e-learning (obsah + test + osvědčení) je 3–4 týdny práce a musí ho garantovat odborně způsobilá osoba v prevenci rizik. Alternativa je partnerství s existujícím poskytovatelem, kde jen zprostředkujeme slevu. Rozhodnout do konce října.
4. Rozsah hodin na osvědčení za záznam: uvádět skutečnou délku záznamu (60–120 min = 1–2 hodiny), nebo balit záznamy do řad po 4–8 hodinách, které se školám lépe vykazují v šablonách OP JAK? Doporučuji obojí: certifikát za díl i souhrnné osvědčení za celou řadu.
