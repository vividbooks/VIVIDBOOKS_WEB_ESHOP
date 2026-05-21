import { useState, useEffect } from 'react';
import { FileText, ExternalLink, Globe, Lock, Edit2, Eye } from 'lucide-react';
import { publicSiteUrl } from '../../utils/publicSiteUrl';

interface FixedPage {
  id: string;
  title: string;
  path: string;
  description: string;
  status: 'active' | 'draft';
  type: 'internal' | 'external';
}

const FIXED_PAGES: FixedPage[] = [
  {
    id: 'katalog',
    title: 'Katalog produktů',
    path: '/',
    description: 'Hlavní stránka s přehledem všech produktů — digitální licence i pracovní sešity.',
    status: 'active',
    type: 'internal',
  },
  {
    id: 'objednavka',
    title: 'Objednávka pro školy',
    path: '/objednat',
    description: 'Formulář poptávky pro školy — generování objednávek a cenových nabídek.',
    status: 'active',
    type: 'internal',
  },
  {
    id: 'webinare',
    title: 'DVPP Webináře',
    path: '/webinare',
    description: 'Seznam webinářů s registračním formulářem. Data se načítají z kolekce Webináře.',
    status: 'active',
    type: 'internal',
  },
  {
    id: 'blog-list',
    title: 'Blog',
    path: '/blog',
    description: 'Přehled blogových příspěvků. Data se načítají z kolekce Blog.',
    status: 'active',
    type: 'internal',
  },
  {
    id: 'novinky-list',
    title: 'Novinky',
    path: '/novinky',
    description: 'Přehled novinek. Data se načítají z kolekce Novinky.',
    status: 'active',
    type: 'internal',
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    path: publicSiteUrl('/cs/kontakt'),
    description: 'Kontaktní stránka na hlavním webu Vividbooks (externě).',
    status: 'active',
    type: 'external',
  },
  {
    id: 'zakaznici',
    title: 'Naši zákazníci',
    path: publicSiteUrl('/cs/zakaznici'),
    description: 'Reference a případové studie zákazníků (externě).',
    status: 'active',
    type: 'external',
  },
  {
    id: 'proc-to-delame',
    title: 'Proč to děláme?',
    path: publicSiteUrl('/cs/proc-to-delame'),
    description: 'Stránka o poslání a vizi Vividbooks (externě).',
    status: 'active',
    type: 'external',
  },
];

export default function FixedPagesManager() {
  const [selectedPage, setSelectedPage] = useState<FixedPage | null>(null);

  return (
    <div className="h-full flex overflow-hidden">
      {/* List */}
      <div className="w-[360px] border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100">
          <h2 className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
            {'Fixní stránky'}
            {' '}
            <span className="text-gray-400 font-normal">({FIXED_PAGES.length})</span>
          </h2>
          <p className="text-[11px] text-gray-400 mt-1">
            {'Stránky, jejichž struktura se nemění. Obsah pochází z kolekcí nebo je statický.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {FIXED_PAGES.map((page) => (
            <button
              key={page.id}
              onClick={() => setSelectedPage(page)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-start gap-3 transition-all ${
                selectedPage?.id === page.id
                  ? 'bg-[#001161] text-white'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                selectedPage?.id === page.id ? 'bg-white/10' : 'bg-gray-100'
              }`}>
                {page.type === 'external' ? (
                  <ExternalLink className={`w-4 h-4 ${selectedPage?.id === page.id ? 'text-white' : 'text-gray-400'}`} />
                ) : (
                  <FileText className={`w-4 h-4 ${selectedPage?.id === page.id ? 'text-white' : 'text-[#001161]'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium ${selectedPage?.id === page.id ? 'text-white' : 'text-[#001161]'}`}>
                  {page.title}
                </div>
                <div className={`text-[11px] truncate ${selectedPage?.id === page.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  {page.path}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                page.status === 'active'
                  ? selectedPage?.id === page.id
                    ? 'bg-emerald-400/20 text-emerald-200'
                    : 'bg-emerald-50 text-emerald-600'
                  : selectedPage?.id === page.id
                  ? 'bg-white/10 text-white/50'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {page.status === 'active' ? 'Aktivní' : 'Draft'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto bg-[#f7f8fc]">
        {selectedPage ? (
          <div className="p-8 max-w-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                {selectedPage.type === 'external' ? (
                  <Globe className="w-7 h-7 text-gray-400" />
                ) : (
                  <FileText className="w-7 h-7 text-[#001161]" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#001161]">{selectedPage.title}</h2>
                <p className="text-[12px] text-gray-400 font-mono mt-0.5">{selectedPage.path}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Popis</h3>
              <p className="text-[13px] text-gray-600 leading-relaxed">{selectedPage.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Typ</h3>
                <p className="text-[13px] font-medium text-[#001161]">
                  {selectedPage.type === 'external' ? 'Externí odkaz' : 'Interní stránka'}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</h3>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedPage.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <p className="text-[13px] font-medium text-[#001161]">
                    {selectedPage.status === 'active' ? 'Aktivní' : 'Draft'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {selectedPage.type === 'internal' ? (
                <a
                  href={selectedPage.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {'Zobrazit stránku'}
                </a>
              ) : (
                <a
                  href={selectedPage.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {'Otevřít externí odkaz'}
                </a>
              )}
            </div>

            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-[12px] font-bold text-amber-800">{'Fixní stránka'}</h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {'Struktura této stránky je definována v kódu. Pro změnu obsahu upravte příslušnou kolekci (Blog, Novinky, Webináře, Produkty) nebo kontaktujte vývojáře.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-300">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-[13px]">{'Vyberte stránku ze seznamu'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
