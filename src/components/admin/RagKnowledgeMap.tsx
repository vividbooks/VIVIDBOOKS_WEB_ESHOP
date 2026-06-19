import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, X, ZoomIn, ZoomOut, Save,
  RefreshCw, ChevronRight, Layers, Check,
  LocateFixed, Minus
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const H = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

// ── Types ──────────────────────────────────────────────────────────────────
export type NodeType = 'root' | 'category' | 'subject' | 'topic' | 'subtopic' | 'detail';

export interface KNode {
  id: string;
  label: string;
  type: NodeType;
  color?: string;
  emoji?: string;
  chunkCount?: number;
  text?: string;
  collapsed?: boolean;
  children?: KNode[];
}

interface LayoutNode extends KNode {
  lx: number; ly: number; lw: number; lh: number;
  cx: number; cy: number;
  depth: number; angle: number;
  parentId?: string;
  inheritedColor: string;
}

// ── Layout constants ───────────────────────────────────────────────────────
//   depth:  0     1     2     3     4     5
const RADII = [0, 255, 480, 700, 915, 1125];

const NODE_SZ: Record<NodeType, [number, number]> = {
  root:     [88,  88],
  category: [155, 50],
  subject:  [140, 40],
  topic:    [124, 32],
  subtopic: [108, 26],
  detail:   [90,  20],
};

// ── Demo tree — vše rozbaleno, 6 úrovní ────────────────────────────────────
const T: KNode = {
  id: 'root', label: 'RAG\nVividbooks', type: 'root', color: '#001161', emoji: '🧠',
  children: [
    // ─── PŘEDMĚTY ───────────────────────────────────────────────────────────
    {
      id: 'predmety', label: 'Předměty', type: 'category', color: '#7C3AED', emoji: '📚', chunkCount: 192,
      children: [
        {
          id: 'fyzika', label: 'Fyzika', type: 'subject', chunkCount: 62,
          children: [
            {
              id: 'fyz-metodika', label: 'Metodika', type: 'topic', chunkCount: 8,
              children: [
                {
                  id: 'fyz-met-planovani', label: 'Plánování hodin', type: 'subtopic', chunkCount: 4,
                  children: [
                    { id: 'fyz-met-plan-priprava', label: 'Příprava', type: 'detail', chunkCount: 2, text: 'Příprava na hodinu fyziky. Pomůcky, cíle, metody.' },
                    { id: 'fyz-met-plan-cile',     label: 'Cíle výuky', type: 'detail', chunkCount: 2, text: 'Výukové cíle dle RVP ZV pro fyziku 6.–9. ročník.' },
                  ],
                },
                {
                  id: 'fyz-met-hodnoceni', label: 'Hodnocení', type: 'subtopic', chunkCount: 4,
                  children: [
                    { id: 'fyz-met-hod-formativni', label: 'Formativní', type: 'detail', chunkCount: 2, text: 'Průběžné hodnocení pokroku žáků v průběhu výuky fyziky.' },
                    { id: 'fyz-met-hod-sumativni',  label: 'Sumativní',  type: 'detail', chunkCount: 2, text: 'Závěrečné hodnocení znalostí a dovedností v fyzice.' },
                  ],
                },
              ],
            },
            {
              id: 'fyz-priklady', label: 'Příklady', type: 'topic', chunkCount: 24,
              children: [
                {
                  id: 'fyz-prik-mechanika', label: 'Mechanika', type: 'subtopic', chunkCount: 12,
                  children: [
                    { id: 'fyz-prik-mech-kinem', label: 'Kinematika', type: 'detail', chunkCount: 6, text: 'Pohyb, rychlost, zrychlení. Rovnoměrný a rovnoměrně zrychlený pohyb.' },
                    { id: 'fyz-prik-mech-dynam', label: 'Dynamika',   type: 'detail', chunkCount: 6, text: 'Newtonovy zákony. Síla, hmotnost, tření a jejich aplikace.' },
                  ],
                },
                {
                  id: 'fyz-prik-elektrina', label: 'Elektřina', type: 'subtopic', chunkCount: 12,
                  children: [
                    { id: 'fyz-prik-el-obvody', label: 'El. obvody',  type: 'detail', chunkCount: 6, text: 'Sériové a paralelní zapojení. Výpočty odporu, napětí a proudu.' },
                    { id: 'fyz-prik-el-proud',  label: 'El. proud',   type: 'detail', chunkCount: 6, text: 'Elektrický proud a jeho účinky. Ohmův zákon a jeho použití.' },
                  ],
                },
              ],
            },
            {
              id: 'fyz-lab', label: 'Lab. práce', type: 'topic', chunkCount: 12,
              children: [
                {
                  id: 'fyz-lab-optika', label: 'Optika', type: 'subtopic', chunkCount: 6,
                  children: [
                    { id: 'fyz-lab-opt-odrazy', label: 'Odrazy světla', type: 'detail', chunkCount: 3, text: 'Laboratorní práce — zákon odrazu a lomu světla.' },
                    { id: 'fyz-lab-opt-cocky',  label: 'Čočky',         type: 'detail', chunkCount: 3, text: 'Laboratorní práce — čočky a jejich zobrazovací vlastnosti.' },
                  ],
                },
                {
                  id: 'fyz-lab-teplo', label: 'Termika', type: 'subtopic', chunkCount: 6,
                  children: [
                    { id: 'fyz-lab-tep-mereni',  label: 'Měření teploty', type: 'detail', chunkCount: 3, text: 'Laboratorní práce — teploměry, kalibrační křivky.' },
                    { id: 'fyz-lab-tep-kalorimetrie', label: 'Kalorimetrie', type: 'detail', chunkCount: 3, text: 'Laboratorní práce — měrná tepelná kapacita, tání ledu.' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'matematika', label: 'Matematika', type: 'subject', chunkCount: 84,
          children: [
            {
              id: 'mat-algebra', label: 'Algebra', type: 'topic', chunkCount: 42,
              children: [
                {
                  id: 'mat-alg-rovnice', label: 'Rovnice', type: 'subtopic', chunkCount: 22,
                  children: [
                    { id: 'mat-alg-rov-linearni',  label: 'Lineární',   type: 'detail', chunkCount: 11, text: 'Lineární rovnice s jednou a dvěma neznámými. Soustava rovnic.' },
                    { id: 'mat-alg-rov-kvadraticke', label: 'Kvadratické', type: 'detail', chunkCount: 11, text: 'Kvadratické rovnice. Diskriminant, Vièteovy vzorce.' },
                  ],
                },
                {
                  id: 'mat-alg-funkce', label: 'Funkce', type: 'subtopic', chunkCount: 20,
                  children: [
                    { id: 'mat-alg-funk-linearni',   label: 'Lineární fce',   type: 'detail', chunkCount: 10, text: 'Lineární funkce y=kx+q. Graf, směrnice, průsečíky.' },
                    { id: 'mat-alg-funk-kvadraticka', label: 'Kvadratická fce', type: 'detail', chunkCount: 10, text: 'Kvadratická funkce y=ax². Parabola, vrchol, osa souměrnosti.' },
                  ],
                },
              ],
            },
            {
              id: 'mat-geometrie', label: 'Geometrie', type: 'topic', chunkCount: 42,
              children: [
                {
                  id: 'mat-geo-planimetrie', label: 'Planimetrie', type: 'subtopic', chunkCount: 22,
                  children: [
                    { id: 'mat-geo-plan-trojuhelniky', label: 'Trojúhelníky', type: 'detail', chunkCount: 11, text: 'Vlastnosti trojúhelníků. Pythagorova věta, trigonometrie.' },
                    { id: 'mat-geo-plan-kruhy',         label: 'Kruhy',       type: 'detail', chunkCount: 11, text: 'Obvod a obsah kruhu. Kružnice, tečna, sečna.' },
                  ],
                },
                {
                  id: 'mat-geo-stereometrie', label: 'Stereometrie', type: 'subtopic', chunkCount: 20,
                  children: [
                    { id: 'mat-geo-ster-hranoly', label: 'Hranoly',  type: 'detail', chunkCount: 10, text: 'Hranol — povrch, objem, síť tělesa.' },
                    { id: 'mat-geo-ster-valce',   label: 'Válce/kužely', type: 'detail', chunkCount: 10, text: 'Válec, kužel, koule — povrch a objem.' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'cestina', label: 'Český jazyk', type: 'subject', chunkCount: 72,
          children: [
            {
              id: 'cj-gramatika', label: 'Gramatika', type: 'topic', chunkCount: 36,
              children: [
                {
                  id: 'cj-gram-morfologie', label: 'Morfologie', type: 'subtopic', chunkCount: 18,
                  children: [
                    { id: 'cj-gram-mor-podstatna', label: 'Podstatná jm.', type: 'detail', chunkCount: 9, text: 'Podstatná jména — vzory, pády, číslo, rod. Skloňování.' },
                    { id: 'cj-gram-mor-slovesa',   label: 'Slovesa',       type: 'detail', chunkCount: 9, text: 'Slovesné vzory. Časy, způsoby, vid, rod. Časování.' },
                  ],
                },
                {
                  id: 'cj-gram-syntax', label: 'Syntax', type: 'subtopic', chunkCount: 18,
                  children: [
                    { id: 'cj-gram-syn-vetna', label: 'Větná skladba', type: 'detail', chunkCount: 9, text: 'Věta jednoduchá a souvětí. Větné členy a jejich určování.' },
                    { id: 'cj-gram-syn-interpunkce', label: 'Interpunkce', type: 'detail', chunkCount: 9, text: 'Pravidla interpunkce v českém jazyce. Čárka, středník, dvojtečka.' },
                  ],
                },
              ],
            },
            {
              id: 'cj-sloh', label: 'Sloh', type: 'topic', chunkCount: 36,
              children: [
                {
                  id: 'cj-sloh-utvary', label: 'Slohové útvary', type: 'subtopic', chunkCount: 18,
                  children: [
                    { id: 'cj-sloh-utv-popis',     label: 'Popis',     type: 'detail', chunkCount: 9, text: 'Popis osoby, věci, děje. Strukturovaný postup.' },
                    { id: 'cj-sloh-utv-vypraveeni', label: 'Vyprávění', type: 'detail', chunkCount: 9, text: 'Vyprávění — přímá řeč, dialog, kompozice.' },
                  ],
                },
                {
                  id: 'cj-sloh-komunikace', label: 'Komunikace', type: 'subtopic', chunkCount: 18,
                  children: [
                    { id: 'cj-sloh-kom-argumentace', label: 'Argumentace', type: 'detail', chunkCount: 9, text: 'Teze, argument, příklad. Úvaha a diskuse.' },
                    { id: 'cj-sloh-kom-formalni',    label: 'Formální texty', type: 'detail', chunkCount: 9, text: 'Žádost, životopis, motivační dopis. Formální styl.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── BLOG ───────────────────────────────────────────────────────────────
    {
      id: 'blog', label: 'Blog', type: 'category', color: '#0369a1', emoji: '✍️', chunkCount: 48,
      children: [
        {
          id: 'blog-digital', label: 'Digitální vzdělávání', type: 'subject', chunkCount: 26,
          children: [
            {
              id: 'blog-dig-transformace', label: 'Transformace', type: 'topic', chunkCount: 14,
              children: [
                {
                  id: 'blog-dig-tr-trendy', label: 'Trendy 2026', type: 'subtopic', chunkCount: 7,
                  children: [
                    { id: 'blog-dig-tr-ai',      label: 'AI ve výuce',    type: 'detail', chunkCount: 4, text: 'Jak umělá inteligence mění způsob, jakým se žáci učí.' },
                    { id: 'blog-dig-tr-adaptivni', label: 'Adaptivní učení', type: 'detail', chunkCount: 3, text: 'Systémy přizpůsobující obsah tempu a stylu každého žáka.' },
                  ],
                },
                {
                  id: 'blog-dig-tr-implementace', label: 'Implementace', type: 'subtopic', chunkCount: 7,
                  children: [
                    { id: 'blog-dig-impl-skoly',   label: 'Školy v ČR',   type: 'detail', chunkCount: 4, text: 'Případové studie škol, které úspěšně zavedly digitální učebnice.' },
                    { id: 'blog-dig-impl-bariery', label: 'Bariéry',      type: 'detail', chunkCount: 3, text: 'Překážky digitalizace: infrastruktura, proškolení, financování.' },
                  ],
                },
              ],
            },
            {
              id: 'blog-dig-tipy', label: 'Tipy pro učitele', type: 'topic', chunkCount: 12,
              children: [
                {
                  id: 'blog-dig-tip-zacinajici', label: 'Začínající', type: 'subtopic', chunkCount: 6,
                  children: [
                    { id: 'blog-dig-tip-zac-prvnikrok', label: '1. kroky',     type: 'detail', chunkCount: 3, text: 'Jak začít s Vividbooks za 15 minut. Krok za krokem.' },
                    { id: 'blog-dig-tip-zac-nastaveni', label: 'Nastavení',    type: 'detail', chunkCount: 3, text: 'Nastavení třídy, přidání žáků, první zadání.' },
                  ],
                },
                {
                  id: 'blog-dig-tip-pokrocili', label: 'Pokročilí', type: 'subtopic', chunkCount: 6,
                  children: [
                    { id: 'blog-dig-tip-pok-diferenciace', label: 'Diferenciace', type: 'detail', chunkCount: 3, text: 'Jak používat Vividbooks pro diferenciaci výuky v heterogenní třídě.' },
                    { id: 'blog-dig-tip-pok-gamifikace',   label: 'Gamifikace',   type: 'detail', chunkCount: 3, text: 'Herní prvky ve výuce — bodování, odznaky, výzvy.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── NOVINKY ────────────────────────────────────────────────────────────
    {
      id: 'novinky', label: 'Novinky', type: 'category', color: '#ff6a35', emoji: '📰', chunkCount: 28,
      children: [
        {
          id: 'nov-2026', label: 'Rok 2026', type: 'subject', chunkCount: 16,
          children: [
            {
              id: 'nov-2026-jaro', label: 'Jaro 2026', type: 'topic', chunkCount: 10,
              children: [
                {
                  id: 'nov-2026-j-tituly', label: 'Nové tituly', type: 'subtopic', chunkCount: 5,
                  children: [
                    { id: 'nov-2026-j-t-chemie',  label: 'Chemie 8. r.',   type: 'detail', chunkCount: 3, text: 'Nová digitální učebnice chemie pro 8. ročník. Dostupná od března 2026.' },
                    { id: 'nov-2026-j-t-dejepis', label: 'Dějepis 9. r.', type: 'detail', chunkCount: 2, text: '20. století v nové interaktivní podobě. Spuštění duben 2026.' },
                  ],
                },
                {
                  id: 'nov-2026-j-funkce', label: 'Nové funkce', type: 'subtopic', chunkCount: 5,
                  children: [
                    { id: 'nov-2026-j-f-ai',      label: 'AI asistent',   type: 'detail', chunkCount: 3, text: 'Integrovaný AI tutor odpovídající na otázky žáků v reálném čase.' },
                    { id: 'nov-2026-j-f-offline',  label: 'Offline režim', type: 'detail', chunkCount: 2, text: 'Stažení obsahu pro výuku bez připojení. iOS a Android.' },
                  ],
                },
              ],
            },
            {
              id: 'nov-2026-zima', label: 'Zima 2025', type: 'topic', chunkCount: 6,
              children: [
                {
                  id: 'nov-2026-zi-testy', label: 'Interaktivní testy', type: 'subtopic', chunkCount: 3,
                  children: [
                    { id: 'nov-2026-zi-t-autoevaluace', label: 'Autoevaluace', type: 'detail', chunkCount: 2, text: 'Žáci hodnotí svůj pokrok sami. Okamžitá zpětná vazba.' },
                    { id: 'nov-2026-zi-t-ucitel',       label: 'Pro učitele',  type: 'detail', chunkCount: 1, text: 'Přehled výsledků testů celé třídy. Exporty a statistiky.' },
                  ],
                },
                {
                  id: 'nov-2026-zi-app', label: 'Aplikace 3.0', type: 'subtopic', chunkCount: 3,
                  children: [
                    { id: 'nov-2026-zi-app-ios',     label: 'iOS & iPadOS', type: 'detail', chunkCount: 2, text: 'Vividbooks 3.0 pro iPad. Optimalizace pro Apple Pencil.' },
                    { id: 'nov-2026-zi-app-android', label: 'Android',      type: 'detail', chunkCount: 1, text: 'Nativní Android aplikace. Podpora tabletů a Chromebooků.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── WEBINÁŘE ───────────────────────────────────────────────────────────
    {
      id: 'webinare', label: 'Webináře', type: 'category', color: '#0891b2', emoji: '🎙️', chunkCount: 16,
      children: [
        {
          id: 'web-metodicke', label: 'Metodické', type: 'subject', chunkCount: 9,
          children: [
            {
              id: 'web-met-diferenciace', label: 'Diferenciace', type: 'topic', chunkCount: 5,
              children: [
                {
                  id: 'web-met-dif-strategie', label: 'Strategie', type: 'subtopic', chunkCount: 3,
                  children: [
                    { id: 'web-met-dif-str-skupiny', label: 'Skupinová práce', type: 'detail', chunkCount: 2, text: 'Webinář: Skupinová práce s Vividbooks. Záznam 45 min.' },
                    { id: 'web-met-dif-str-individ',  label: 'Individuální',   type: 'detail', chunkCount: 1, text: 'Webinář: Individualizace tempa a náročnosti. Záznam 38 min.' },
                  ],
                },
                {
                  id: 'web-met-dif-nastroje', label: 'Nástroje', type: 'subtopic', chunkCount: 2,
                  children: [
                    { id: 'web-met-dif-nas-portfolio', label: 'Portfolio',  type: 'detail', chunkCount: 1, text: 'Jak sbírat a hodnotit portfolio žákovských prací.' },
                    { id: 'web-met-dif-nas-feedback',  label: 'Zpětná vazba', type: 'detail', chunkCount: 1, text: 'Automatická a manuální zpětná vazba. Nastavení v platformě.' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'web-technicke', label: 'Technické', type: 'subject', chunkCount: 7,
          children: [
            {
              id: 'web-tech-nastaveni', label: 'Nastavení', type: 'topic', chunkCount: 7,
              children: [
                {
                  id: 'web-tech-nas-licence', label: 'Licence', type: 'subtopic', chunkCount: 4,
                  children: [
                    { id: 'web-tech-nas-lic-skolni',   label: 'Školní licence',   type: 'detail', chunkCount: 2, text: 'Hromadné přiřazení licencí třídám. Správa přes admin panel.' },
                    { id: 'web-tech-nas-lic-individualni', label: 'Individuální', type: 'detail', chunkCount: 2, text: 'Licence pro jednotlivé žáky. Aktivace kódem nebo emailem.' },
                  ],
                },
                {
                  id: 'web-tech-nas-integrace', label: 'Integrace', type: 'subtopic', chunkCount: 3,
                  children: [
                    { id: 'web-tech-int-bakalari', label: 'Bakaláři',   type: 'detail', chunkCount: 2, text: 'Propojení s Bakaláři — synchronizace žáků a tříd.' },
                    { id: 'web-tech-int-google',   label: 'Google SSO', type: 'detail', chunkCount: 1, text: 'Přihlášení přes Google Workspace for Education. Nastavení.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── VLASTNÍ DOKUMENTY ──────────────────────────────────────────────────
    {
      id: 'vlastni', label: 'Vlastní\ndokumenty', type: 'category', color: '#16a34a', emoji: '📁', chunkCount: 9,
      children: [
        {
          id: 'doc-obchod', label: 'Obchodní', type: 'subject', chunkCount: 5,
          children: [
            {
              id: 'doc-obc-cenik', label: 'Ceník', type: 'topic', chunkCount: 3,
              children: [
                {
                  id: 'doc-obc-cen-skolni', label: 'Školní licence', type: 'subtopic', chunkCount: 2,
                  children: [
                    { id: 'doc-obc-cen-sk-2026', label: 'Ceník 2026', type: 'detail', chunkCount: 1, text: 'Školní licence: 29 Kč/žák/měsíc. Platnost od 1. 1. 2026.' },
                    { id: 'doc-obc-cen-sk-sleva', label: 'Slevy',     type: 'detail', chunkCount: 1, text: 'Množstevní slevy: 10+ tříd = 15%, 20+ tříd = 25%.' },
                  ],
                },
                {
                  id: 'doc-obc-cen-individualni', label: 'Individuální', type: 'subtopic', chunkCount: 1,
                  children: [
                    { id: 'doc-obc-cen-ind-mesic', label: 'Měsíční',  type: 'detail', chunkCount: 1, text: 'Individuální měsíční licence: 49 Kč/měsíc/předmět.' },
                    { id: 'doc-obc-cen-ind-rocni',  label: 'Roční',   type: 'detail', chunkCount: 1, text: 'Roční licence: 399 Kč/rok/předmět. Úspora 32 %.' },
                  ],
                },
              ],
            },
            {
              id: 'doc-obc-prezentace', label: 'Prezentace', type: 'topic', chunkCount: 2,
              children: [
                {
                  id: 'doc-obc-pre-reditele', label: 'Pro reditele', type: 'subtopic', chunkCount: 1,
                  children: [
                    { id: 'doc-obc-pre-red-obecna', label: 'Obecná prez.', type: 'detail', chunkCount: 1, text: 'Prodejní prezentace pro ředitele a zřizovatele. 24 slidů.' },
                    { id: 'doc-obc-pre-red-roi',    label: 'ROI kalkulace', type: 'detail', chunkCount: 1, text: 'Návratnost investice do Vividbooks. Porovnání s tištěnými učebnicemi.' },
                  ],
                },
                {
                  id: 'doc-obc-pre-rodicovske', label: 'Pro rodice', type: 'subtopic', chunkCount: 1,
                  children: [
                    { id: 'doc-obc-pre-rod-info',  label: 'Infolist',   type: 'detail', chunkCount: 1, text: 'Jednolistový souhrn výhod Vividbooks pro rodičovský spolek.' },
                    { id: 'doc-obc-pre-rod-gdpr',  label: 'GDPR info',  type: 'detail', chunkCount: 1, text: 'Zásady zpracování osobních údajů žáků. GDPR souhlas.' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ── Tree helpers ───────────────────────────────────────────────────────────
function countLeaves(node: KNode): number {
  const vis = node.collapsed ? [] : (node.children ?? []);
  if (vis.length === 0) return 1;
  return vis.reduce((s, c) => s + countLeaves(c), 0);
}

function computeRadialLayout(tree: KNode): LayoutNode[] {
  const flat: LayoutNode[] = [];

  function layout(
    node: KNode, depth: number,
    startAngle: number, endAngle: number,
    parentId?: string, inherited?: string
  ) {
    const r     = RADII[Math.min(depth, RADII.length - 1)];
    const angle = (startAngle + endAngle) / 2;
    const color = node.color ?? inherited ?? '#001161';
    const cx    = r * Math.cos(angle - Math.PI / 2);
    const cy    = r * Math.sin(angle - Math.PI / 2);
    const [lw, lh] = NODE_SZ[node.type] ?? [90, 20];

    flat.push({ ...node, lx: cx - lw / 2, ly: cy - lh / 2, lw, lh, cx, cy, depth, angle, parentId, inheritedColor: color });

    const visible = node.collapsed ? [] : (node.children ?? []);
    if (visible.length === 0) return;

    const counts = visible.map(c => countLeaves(c));
    const total  = counts.reduce((a, b) => a + b, 0);

    if (depth === 0) {
      // Proportional distribution so larger branches get wider sectors
      let cur = 0;
      for (let i = 0; i < visible.length; i++) {
        const arc = (counts[i] / total) * Math.PI * 2;
        layout(visible[i], 1, cur, cur + arc, node.id, inherited);
        cur += arc;
      }
    } else {
      const sector = endAngle - startAngle;
      const spread = Math.min(sector * 0.92, Math.PI * 1.6);
      const margin = (sector - spread) / 2;
      let cur = startAngle + margin;
      for (let i = 0; i < visible.length; i++) {
        const arc = (counts[i] / total) * spread;
        layout(visible[i], depth + 1, cur, cur + arc, node.id, color);
        cur += arc;
      }
    }
  }

  layout(tree, 0, 0, Math.PI * 2);
  return flat;
}

function treeUpdate(node: KNode, id: string, updater: (n: KNode) => KNode): KNode {
  if (node.id === id) return updater(node);
  if (!node.children) return node;
  return { ...node, children: node.children.map(c => treeUpdate(c, id, updater)) };
}
function treeDelete(node: KNode, id: string): KNode {
  if (!node.children) return node;
  return { ...node, children: node.children.filter(c => c.id !== id).map(c => treeDelete(c, id)) };
}
function treeAddChild(node: KNode, parentId: string, child: KNode): KNode {
  if (node.id === parentId) return { ...node, children: [...(node.children ?? []), child], collapsed: false };
  if (!node.children) return node;
  return { ...node, children: node.children.map(c => treeAddChild(c, parentId, child)) };
}
function findNode(node: KNode, id: string): KNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const f = findNode(c, id); if (f) return f; }
  return null;
}
function getBreadcrumb(tree: KNode, targetId: string): string[] {
  const path: string[] = [];
  const walk = (node: KNode): boolean => {
    if (node.id === targetId) { path.push(node.label.replace('\n', ' ')); return true; }
    for (const c of node.children ?? []) {
      if (walk(c)) { path.unshift(node.label.replace('\n', ' ')); return true; }
    }
    return false;
  };
  walk(tree);
  return path;
}

// ── Connection path ────────────────────────────────────────────────────────
function connectionPath(parent: LayoutNode, child: LayoutNode): string {
  if (parent.type === 'root') return `M ${parent.cx} ${parent.cy} L ${child.cx} ${child.cy}`;
  const mx = (parent.cx + child.cx) / 2;
  const my = (parent.cy + child.cy) / 2;
  const mr = Math.sqrt(mx * mx + my * my) || 1;
  const cpx = (mx / mr) * mr * 1.1;
  const cpy = (my / mr) * mr * 1.1;
  return `M ${parent.cx} ${parent.cy} Q ${cpx} ${cpy} ${child.cx} ${child.cy}`;
}

// ── Node style ─────────────────────────────────────────────────────────────
function nodeStyle(node: LayoutNode, selected: boolean): React.CSSProperties {
  const c = node.inheritedColor;
  const glow = selected ? `0 0 0 2.5px ${c}, 0 0 14px ${c}60` : '';
  switch (node.type) {
    case 'root':
      return { background: c, color: '#fff', borderRadius: '50%', boxShadow: selected ? glow : '0 4px 20px rgba(0,0,20,0.28)' };
    case 'category':
      return { background: c, color: '#fff', borderRadius: 22, boxShadow: selected ? glow : `0 3px 14px ${c}45` };
    case 'subject':
      return { background: '#fff', color: '#001161', borderRadius: 13, boxShadow: selected ? glow : `0 2px 8px ${c}28`, borderLeft: `3px solid ${c}`, border: selected ? `1.5px solid ${c}` : `1px solid ${c}20` };
    case 'topic':
      return { background: `${c}14`, color: '#001161', borderRadius: 10, boxShadow: selected ? glow : '', border: selected ? `1.5px solid ${c}` : `1px solid ${c}30` };
    case 'subtopic':
      return { background: `${c}0d`, color: '#001161', borderRadius: 8, border: selected ? `1.5px solid ${c}` : `1px solid ${c}25`, boxShadow: selected ? glow : '' };
    case 'detail':
      return { background: '#fff', color: '#334155', borderRadius: 6, border: selected ? `1.5px solid ${c}` : `1px solid ${c}20`, boxShadow: selected ? glow : '0 1px 3px rgba(0,0,0,0.06)' };
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export function RagKnowledgeMap() {
  const [tree, setTree]           = useState<KNode>(T);
  const [vp, setVp]               = useState({ x: 0, y: 0, scale: 0.38 });
  const [selectedId, setSel]      = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editText,  setEditText]  = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });

  // Center on mount at scale 0.38
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setVp({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale: 0.38 });
  }, []);

  // Load saved tree
  useEffect(() => {
    fetch(`${BASE}/rag/tree`, { headers: H })
      .then(r => r.json())
      .then(d => { if (d.tree) setTree(d.tree); })
      .catch(() => {});
  }, []);

  const flat = useMemo(() => computeRadialLayout(tree), [tree]);
  const selectedNode = flat.find(n => n.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedNode) {
      setEditLabel(selectedNode.label.replace('\n', ' '));
      setEditText(selectedNode.text ?? '');
    }
  }, [selectedId]);

  // Zoom to cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.91 : 1.1;
      setVp(prev => {
        const ns = Math.max(0.1, Math.min(4, prev.scale * factor));
        const canX = (mx - prev.x) / prev.scale, canY = (my - prev.y) / prev.scale;
        return { x: mx - canX * ns, y: my - canY * ns, scale: ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-nodeid]')) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setVp(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onMouseUp = () => { isDragging.current = false; };

  const zoomBtn = (f: number) => setVp(p => ({ ...p, scale: Math.max(0.1, Math.min(4, p.scale * f)) }));
  const resetView = () => {
    const el = containerRef.current;
    if (!el) return;
    setVp({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale: 0.38 });
  };

  const mutateTree = (u: (t: KNode) => KNode) => setTree(u);
  const toggleCollapse = (id: string) => mutateTree(t => treeUpdate(t, id, n => ({ ...n, collapsed: !n.collapsed })));

  const saveNode = async () => {
    if (!selectedId) return;
    setSaving(true);
    const next = treeUpdate(tree, selectedId, n => ({ ...n, label: editLabel, text: editText }));
    setTree(next);
    try {
      await fetch(`${BASE}/rag/tree`, { method: 'PUT', headers: H, body: JSON.stringify({ tree: next }) });
      setSaveMsg('Uloženo ✓');
    } catch { setSaveMsg('Chyba'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const deleteNode = (id: string) => {
    if (id === 'root') return;
    setSel(null);
    const next = treeDelete(tree, id);
    setTree(next);
    fetch(`${BASE}/rag/tree`, { method: 'PUT', headers: H, body: JSON.stringify({ tree: next }) }).catch(() => {});
  };

  const addChild = (parentId: string) => {
    const parent = findNode(tree, parentId);
    const typeMap: Record<string, NodeType> = { category: 'subject', subject: 'topic', topic: 'subtopic', subtopic: 'detail' };
    const childType: NodeType = typeMap[parent?.type ?? 'topic'] ?? 'detail';
    const labelMap: Record<string, string> = { subject: 'Nový předmět', topic: 'Nové téma', subtopic: 'Nové podtéma', detail: 'Nový detail' };
    const newNode: KNode = { id: `node-${Date.now()}`, label: labelMap[childType] ?? 'Nový uzel', type: childType, chunkCount: 0, text: '' };
    setTree(t => treeAddChild(t, parentId, newNode));
    setTimeout(() => setSel(newNode.id), 60);
  };

  const addToRag = async () => {
    if (!selectedNode || !editText.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}/rag/chunk`, {
        method: 'POST', headers: H,
        body: JSON.stringify({
          text: `${editLabel}\n\n${editText}`,
          metadata: { source: 'Znalostní mapa', category: getBreadcrumb(tree, selectedId!)[1] ?? 'Vlastní', subject: editLabel },
        }),
      });
      setSaveMsg('Přidáno do RAG ✓');
    } catch { setSaveMsg('Chyba RAG'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 2500);
  };

  // Connection stroke width by depth
  const strokeW = (type: NodeType) =>
    ({ root: 0, category: 2.5, subject: 2, topic: 1.5, subtopic: 1, detail: 0.7 }[type] ?? 1);

  // Font size by node type
  const fontSize = (type: NodeType) =>
    ({ root: 11, category: 12, subject: 12, topic: 11, subtopic: 10, detail: 9 }[type] ?? 10);

  return (
    <div className="flex h-full overflow-hidden select-none">
      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, #e8ecfc 0%, #f3f5fe 50%, #f8f9fd 100%)', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onClick={() => setSel(null)}
      >
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
          <defs>
            <pattern id="kmdots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.4" cy="1.4" r="1.1" fill="#b0bcdf" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kmdots)" />
        </svg>

        {/* Concentric guide rings */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {RADII.slice(1).map((r, i) => (
            <circle key={r} cx={vp.x} cy={vp.y} r={r * vp.scale}
              fill="none" stroke="#c0ccee" strokeWidth="1"
              strokeDasharray={i < 2 ? '5 9' : '3 7'}
              opacity={0.3 - i * 0.04} />
          ))}
        </svg>

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1 bg-white/90 backdrop-blur border border-gray-100 rounded-2xl px-2 py-1.5 shadow-sm">
          <button onClick={() => zoomBtn(1.22)} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors text-[#001161]" title="Přiblížit"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => zoomBtn(0.8)}  className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors text-[#001161]" title="Oddálit"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={resetView}           className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors text-[#001161]" title="Celkový pohled"><LocateFixed className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <span className="font-mono text-[11px] text-[#001161]/40 pr-1 tabular-nums">{Math.round(vp.scale * 100)}%</span>
        </div>

        {/* Depth legend */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-0.5">
          {(['category','subject','topic','subtopic','detail'] as NodeType[]).map((t, i) => (
            <div key={t} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: ['#7C3AED','#0369a1','#ff6a35','#0891b2','#16a34a'][i] + '90' }} />
              <span className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/35 capitalize">
                {['Kategorie','Předmět','Téma','Podtéma','Detail'][i]}
              </span>
            </div>
          ))}
        </div>

        {/* ── Transformed canvas ── */}
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 0, height: 0,
          transform: `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`,
          transformOrigin: '0 0', willChange: 'transform',
        }}>
          {/* SVG connections */}
          <svg viewBox="-1300 -1300 2600 2600"
            style={{ position: 'absolute', left: -1300, top: -1300, width: 2600, height: 2600, overflow: 'visible', pointerEvents: 'none' }}>
            {flat.map(node => {
              if (!node.parentId) return null;
              const parent = flat.find(n => n.id === node.parentId);
              if (!parent) return null;
              const dimmed = !!selectedId && selectedId !== node.id && selectedId !== node.parentId;
              const hilit  = selectedId === node.id || selectedId === node.parentId;
              const w = strokeW(node.type);
              return (
                <path key={`c-${node.id}`}
                  d={connectionPath(parent, node)}
                  stroke={node.inheritedColor}
                  strokeWidth={hilit ? w + 1 : w}
                  fill="none" strokeLinecap="round"
                  opacity={dimmed ? 0.06 : hilit ? 0.85 : node.depth >= 4 ? 0.22 : node.depth === 3 ? 0.3 : 0.45}
                  style={{ transition: 'opacity 0.15s' }}
                />
              );
            })}
            {/* Glow rings under categories */}
            {flat.filter(n => n.type === 'category').map(node => (
              <circle key={`ring-${node.id}`}
                cx={node.cx} cy={node.cy}
                r={Math.max(node.lw, node.lh) / 2 + 8}
                fill={node.inheritedColor}
                opacity={selectedId === node.id ? 0.1 : 0.04}
                style={{ transition: 'opacity 0.2s' }}
              />
            ))}
          </svg>

          {/* Nodes */}
          {flat.map(node => {
            const isSelected = selectedId === node.id;
            const isDimmed   = !!selectedId && !isSelected && selectedId !== node.parentId;
            const hasKids    = (node.children ?? []).length > 0;
            const style      = nodeStyle(node, isSelected);
            const fs         = fontSize(node.type);
            const isDeep     = node.depth >= 4;

            return (
              <div key={node.id} data-nodeid={node.id}
                style={{
                  position: 'absolute',
                  left: node.lx, top: node.ly,
                  width: node.lw, height: node.lh,
                  opacity: isDimmed ? 0.12 : 1,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: node.type === 'root' ? '5px' : isDeep ? '0 6px' : '0 8px',
                  userSelect: 'none',
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  ...style,
                }}
                onClick={e => {
                  e.stopPropagation();
                  setSel(node.id);
                  if (hasKids && node.collapsed) toggleCollapse(node.id);
                }}
              >
                {/* Root */}
                {node.type === 'root' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 20 }}>{node.emoji}</span>
                    {node.label.split('\n').map((l, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Fenomen Sans, sans-serif', lineHeight: 1.1, textAlign: 'center', color: '#fff' }}>{l}</span>
                    ))}
                  </div>
                )}

                {/* Category */}
                {node.type === 'category' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{node.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fs, fontWeight: 700, fontFamily: 'Fenomen Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label.replace('\n',' ')}</div>
                      {node.chunkCount !== undefined && <div style={{ fontSize: 8.5, opacity: 0.6, fontFamily: 'Fenomen Sans, sans-serif' }}>{node.chunkCount} ch</div>}
                    </div>
                    {hasKids && (
                      <button onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.28)' }}>
                        {node.collapsed ? <Plus style={{ width: 10, height: 10 }} /> : <Minus style={{ width: 10, height: 10 }} />}
                      </button>
                    )}
                  </div>
                )}

                {/* Subject */}
                {node.type === 'subject' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fs, fontWeight: 700, fontFamily: 'Fenomen Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</div>
                      {node.chunkCount !== undefined && <div style={{ fontSize: 8.5, opacity: 0.45, fontFamily: 'Fenomen Sans, sans-serif' }}>{node.chunkCount} ch</div>}
                    </div>
                    {hasKids && (
                      <button onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: node.inheritedColor + '15' }}>
                        {node.collapsed ? <Plus style={{ width: 9, height: 9, color: node.inheritedColor }} /> : <Minus style={{ width: 9, height: 9, color: node.inheritedColor }} />}
                      </button>
                    )}
                  </div>
                )}

                {/* Topic */}
                {node.type === 'topic' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fs, fontWeight: 600, fontFamily: 'Fenomen Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</div>
                    </div>
                    {hasKids && (
                      <button onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: node.inheritedColor + '15' }}>
                        {node.collapsed ? <Plus style={{ width: 8, height: 8, color: node.inheritedColor }} /> : <Minus style={{ width: 8, height: 8, color: node.inheritedColor }} />}
                      </button>
                    )}
                  </div>
                )}

                {/* Subtopic */}
                {node.type === 'subtopic' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: node.inheritedColor, opacity: 0.7, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: fs, fontWeight: 600, fontFamily: 'Fenomen Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#001161' }}>{node.label}</div>
                    {hasKids && (
                      <button onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ flexShrink: 0, width: 14, height: 14, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: node.inheritedColor + '18' }}>
                        {node.collapsed ? <Plus style={{ width: 7, height: 7, color: node.inheritedColor }} /> : <Minus style={{ width: 7, height: 7, color: node.inheritedColor }} />}
                      </button>
                    )}
                  </div>
                )}

                {/* Detail */}
                {node.type === 'detail' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: node.inheritedColor, opacity: 0.5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: fs, fontWeight: 500, fontFamily: 'Fenomen Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569' }}>{node.label}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div key={selectedNode.id}
            initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-[290px] bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0 z-30"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-['Fenomen_Sans',sans-serif] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: selectedNode.inheritedColor + '14', color: selectedNode.inheritedColor }}>
                  {({ root:'Kořen', category:'Kategorie', subject:'Předmět', topic:'Téma', subtopic:'Podtéma', detail:'Detail' })[selectedNode.type]}
                </span>
                <button onClick={() => setSel(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {getBreadcrumb(tree, selectedNode.id).map((crumb, i, arr) => (
                  <React.Fragment key={crumb + i}>
                    <span className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/40">{crumb}</span>
                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-[#001161]/20" />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="font-['Fenomen_Sans',sans-serif] text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Název</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161] focus:outline-none focus:border-[#001161]/40" />
              </div>

              <div>
                <label className="font-['Fenomen_Sans',sans-serif] text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Obsah znalosti</label>
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={6}
                  placeholder="Popište obsah…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161] focus:outline-none focus:border-[#001161]/40 resize-none leading-relaxed" />
                <div className="flex justify-between mt-1">
                  <span className="font-['Fenomen_Sans',sans-serif] text-[9.5px] text-[#001161]/30">RAG chunk</span>
                  <span className="font-mono text-[9.5px] text-[#001161]/30">{editText.split(/\s+/).filter(Boolean).length} slov</span>
                </div>
              </div>

              {selectedNode.chunkCount !== undefined && (
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: selectedNode.inheritedColor + '0c' }}>
                  <div>
                    <div className="font-['Cooper_Light',serif] text-[26px] leading-none" style={{ color: selectedNode.inheritedColor }}>{selectedNode.chunkCount}</div>
                    <div className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/40">chunků</div>
                  </div>
                  {(selectedNode.children ?? []).length > 0 && (
                    <div className="ml-auto text-right">
                      <div className="font-['Cooper_Light',serif] text-[20px] text-[#001161]/40">{(selectedNode.children ?? []).length}</div>
                      <div className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/30">poduzlů</div>
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'category' && (
                <div>
                  <label className="font-['Fenomen_Sans',sans-serif] text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">Barva</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#7C3AED','#001161','#0369a1','#ff6a35','#0891b2','#16a34a','#dc2626','#d97706'].map(col => (
                      <button key={col} onClick={() => mutateTree(t => treeUpdate(t, selectedNode.id, n => ({ ...n, color: col })))}
                        className="w-6 h-6 rounded-lg border-2 transition-all"
                        style={{ background: col, borderColor: selectedNode.color === col ? '#001161' : 'transparent' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-2">
              {saveMsg && (
                <div className="text-center font-['Fenomen_Sans',sans-serif] text-[11px] text-emerald-600 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" />{saveMsg}
                </div>
              )}
              <button onClick={saveNode} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#001161] disabled:opacity-50 text-white py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[12px] font-bold hover:opacity-85 transition-opacity">
                {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Ukládám…</> : <><Save className="w-3.5 h-3.5" />Uložit</>}
              </button>

              {selectedNode.type !== 'detail' && (
                <button onClick={() => addChild(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed py-2 rounded-xl font-['Fenomen_Sans',sans-serif] text-[11px] hover:opacity-75 transition-opacity"
                  style={{ borderColor: selectedNode.inheritedColor + '50', color: selectedNode.inheritedColor }}>
                  <Plus className="w-3.5 h-3.5" />
                  {({ category:'Přidat předmět', subject:'Přidat téma', topic:'Přidat podtéma', subtopic:'Přidat detail', root:'Přidat kategorii' }[selectedNode.type])}
                </button>
              )}

              {(selectedNode.type === 'subtopic' || selectedNode.type === 'detail') && editText.trim().length > 15 && (
                <button onClick={addToRag} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 border py-2 rounded-xl font-['Fenomen_Sans',sans-serif] text-[11px] font-bold hover:opacity-80 transition-opacity"
                  style={{ borderColor: '#16a34a40', color: '#16a34a', background: '#f0fdf4' }}>
                  <Layers className="w-3.5 h-3.5" />Přidat do RAG
                </button>
              )}

              {selectedNode.id !== 'root' && (
                <button onClick={() => deleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-600 hover:bg-red-50 py-2 rounded-xl font-['Fenomen_Sans',sans-serif] text-[11px] transition-all">
                  <Trash2 className="w-3.5 h-3.5" />Smazat
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
