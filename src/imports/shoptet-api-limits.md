1. Přidání do košíku z externího frontendu
Existuje JS API, ale funguje jen na Shoptet doméně. Shoptet poskytuje funkci:
jsshoptet.cartShared.addToCart({priceId: 1745});
shoptet.cartShared.addToCart({productCode: '183/GSB'});
shoptet.cartShared.addToCart({productId: 183, parameterValueId: {78: 210, 10: 204}});
// s množstvím a tichým režimem (bez popup okna):
shoptet.cartShared.addToCart({priceId: 1745, amount: 2}, true);
Tři způsoby identifikace produktu: priceId (unikátní ID položky v ceníku), productCode (kód produktu/varianty), nebo productId + parameterValueId (pro varianty).
Háček: Objekt shoptet.cartShared existuje jen v kontextu Shoptet šablony — je součástí Shoptet JS bundlu, který se načítá na doméně e-shopu. Z tvého externího React frontendu na jiné doméně tuto funkci zavolat nemůžeš, protože ten JavaScript prostě není dostupný a košík je vázaný na session cookies Shoptetu.
Neexistuje žádný veřejný URL parametr typu ?action=add&productId=XXX, který by fungoval jako cross-domain add-to-cart endpoint.
Realistická alternativa: Pokud máš Shoptet Premium a blank template mode, můžeš svůj React frontend nasadit přímo na Shoptet doménu jako custom šablonu, kde pak shoptet.cartShared fungovat bude. Nebo řešit přes server-side API (viz bod 3).

2. Embeddable checkout / popup
Shoptet žádný embeddable checkout widget, iframe řešení ani popup checkout nenabízí. Nic jako Shopify Buy Button SDK nebo embeddable cart tu neexistuje.
Checkout proces je integrální součástí Shoptet frontendu a běží výhradně na doméně e-shopu. Shoptet ho neposkytuje jako samostatnou komponentu, kterou by šlo vložit do cizího webu.
Proč to nefunguje: Shoptet je monolitická SaaS platforma — košík, checkout, platební brány a session management jsou pevně svázány s Shoptet doménou a jeho interním renderovacím enginem. Na rozdíl od headless platforem (Shopify, commercetools) tu není oddělený checkout layer.
Realistické alternativy:

Redirect zákazníka na Shoptet checkout (nejjednodušší, ale opouští váš frontend)
POST /api/orders přes API — vytvořit objednávku programaticky celou na backendu a pak zákazníka přesměrovat na platební bránu (viz bod 3)
Blank template mode (Premium) — přepsat Shoptet frontend kompletně včetně checkoutu vlastním designem, ale stále na Shoptet doméně


3. Shoptet API — košík a objednávky
Shoptet REST API (https://api.myshoptet.com/api/) je poměrně bohaté, ale s důležitými omezeními:
Co API umí ohledně objednávek:

POST /api/orders — ano, lze programaticky vytvořit kompletní objednávku včetně produktů, dopravy, platby, slev, adres. Endpoint je detailně zdokumentovaný s podporou různých typů položek (product, shipping, billing, discount-coupon, volume-discount, gift, product-set, bazar, service).
CRUD operace na objednávkách — čtení, update statusů, historie, položky, platby, doprava
Webhooks — notifikace o nových objednávkách (order:create, order:update)
Účetní doklady — faktury, dobropisy, dodací listy, proforma

Co API neumí / chybí:

Neexistuje Cart API — žádný endpoint pro vzdálenou manipulaci s košíkem (/api/cart neexistuje). Košík je čistě frontend/session záležitost.
API na vytváření objednávek je dle dokumentace primárně určeno pro import starých objednávek z jiných systémů nebo registraci objednávek z externích kanálů (Heureka apod.), ne jako real-time storefront checkout.

Dva režimy přístupu k API:

Addon API — pro veřejné doplňky v marketplace, OAuth2 flow, musí být schválené Shoptetem
Private API (jen Premium) — přímý přístup přes privátní token, header Shoptet-Private-API-Token, přístup ke všem endpointům bez schvalování

Pro tvůj use case headless frontendu je Private API (Premium) jediná reálná cesta, protože Addon API vyžaduje schválení Shoptetem a je primárně určené pro veřejné doplňky.
Praktický flow pro headless:

React frontend → tvůj backend server
Backend volá POST /api/orders s Private API tokenem
V odpovědi dostaneš order ID
Zákazníka přesměruješ na platební bránu (toto je ale problematické — viz dál)

Zásadní problém: I když objednávku vytvoříš, Shoptet API ti nevrátí URL platební brány pro zákazníka. Platební flow je svázaný s Shoptet checkoutem. Takže budeš muset řešit platbu mimo Shoptet (vlastní integrace Stripe/GoPay), nebo zákazníka na platbu přesměrovat na Shoptet.

4. Shoptet Buy Button
Neexistuje. Shoptet nemá žádný ekvivalent Shopify Buy Button SDK — žádný embeddable widget, JS snippet ani iframe řešení, které bys mohl vložit na externí web.
Shoptet ekosystém je orientovaný na to, že veškerý prodej probíhá na Shoptet doméně. Celý „addon" systém je postavený na rozšiřování stávajícího Shoptetu, ne na extrakci jeho funkcí ven.

5. CORS a cookies
CORS — API: Shoptet REST API (api.myshoptet.com) je server-to-server API. Dokumentace jasně říká, že OAuth access token se nesmí posílat na klientský počítač. API tokeny (jak addon, tak private) jsou určeny pro backend-to-backend komunikaci. Volání z browseru přímo by tedy mělo selhat na CORS (API server pravděpodobně nenastavuje Access-Control-Allow-Origin pro libovolné domény) a i kdyby neselhal, byl by to bezpečnostní problém.
Cookies — košík: Shoptet košík je session-based, cookies jsou vázané na doménu e-shopu (first-party). Z jiné domény k nim nemáš přístup, a s moderními SameSite cookie politikami (Chrome defaultně SameSite=Lax) by cross-domain iframe přístup nefungoval ani technicky.
Shrnutí CORS omezení:

shoptet.cartShared.addToCart() — funguje jen na Shoptet doméně (JS bundle + session)
REST API — jen server-to-server, ne z browser JS na jiné doméně
Cookies — first-party, cross-domain nefunkční


Doporučená architektura
Vzhledem ke všem omezením máš reálně tři cesty:
A) Blank Template Mode (Premium) — Nejbližší k „headless". Nasadíš svůj React na Shoptet doménu, vypneš Shoptet CSS/JS a napíšeš vlastní. Máš přístup k shoptet.cartShared, checkout funguje nativně. Ale pořád jsi na Shoptet doméně a v jeho HTML struktuře.
B) Hybrid: React frontend + API backend + redirect na checkout — Tvůj React frontend na vlastní doméně, backend tahá produkty přes API, ale pro košík a checkout přesměruješ zákazníka na Shoptet. Ztratíš seamless UX, ale funguje to spolehlivě.
C) Plně API-driven (nejsložitější) — React frontend, tvůj backend vytváří objednávky přes POST /api/orders, platby řešíš vlastní integrací (GoPay, Stripe). Shoptet slouží jen jako order management a fulfillment systém. Funguje, ale obcházíš celý Shoptet checkout a platební flow, což přidává hodně komplexity.
Cesta A je pravděpodobně nejrozumnější poměr effort/výsledek, pokud je Premium akceptovatelný cenově.