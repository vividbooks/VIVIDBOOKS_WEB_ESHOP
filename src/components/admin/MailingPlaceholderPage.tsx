import { Mail, Sparkles, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

export default function MailingPlaceholderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const page = useMemo(() => {
    if (location.pathname.endsWith('/audience')) {
      return {
        icon: Users,
        eyebrow: 'Audience',
        title: 'Audience pro vlastní mailing',
        body: 'Tady později vznikne vlastní práce se segmenty, kontakty a stavem odběru mimo marketingovou sekci.',
        ctaLabel: 'Otevřít Emaily',
        ctaPath: '/mailing/emaily',
      };
    }
    return {
      icon: Sparkles,
      eyebrow: 'Automatizace',
      title: 'Automatizace pro druhý mailchimp',
      body: 'Sem připravíme automatizační flow, sekvence a triggry pro vlastní e-mailing. Zatím nechávám jen samostatnou sekci a navigaci.',
      ctaLabel: 'Vytvořit nový email',
      ctaPath: '/mailing/novy-email',
    };
  }, [location.pathname]);

  const Icon = page.icon;

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_10px_30px_rgba(0,17,97,0.06)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-50 px-3 py-1 text-fuchsia-700">
          <Icon className="h-4 w-4" />
          <span style={FF} className="text-[11px] font-bold uppercase tracking-[0.12em]">
            {page.eyebrow}
          </span>
        </div>

        <h1 style={FF} className="mt-5 text-[28px] font-bold leading-tight text-[#001161]">
          {page.title}
        </h1>
        <p style={FF} className="mt-3 max-w-2xl text-[15px] leading-7 text-[#001161]/60">
          {page.body}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate(page.ctaPath)}
            className="rounded-2xl bg-[#001161] px-5 py-3 text-left text-white transition-all hover:opacity-95"
          >
            <span style={FF} className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
              Další krok
            </span>
            <span style={FF} className="mt-1 block text-[16px] font-bold">
              {page.ctaLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/mailing/emaily')}
            className="rounded-2xl border border-gray-200 bg-[#fafbfd] px-5 py-3 text-left transition-all hover:border-fuchsia-200 hover:bg-fuchsia-50/40"
          >
            <span style={FF} className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#001161]/35">
              Mailing
            </span>
            <span style={FF} className="mt-1 block text-[16px] font-bold text-[#001161]">
              Otevřít editor e-mailů
            </span>
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-fuchsia-600" />
            <div>
              <p style={FF} className="text-[13px] font-bold text-[#001161]">
                Samostatný mailing je připravený v navigaci
              </p>
              <p style={FF} className="mt-1 text-[12px] leading-6 text-[#001161]/55">
                Cílem téhle sekce je postupně vyrůst ve vlastní interní alternativu k Mailchimpu. Zatím je oddělená od marketingu a má vlastní záložky.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
