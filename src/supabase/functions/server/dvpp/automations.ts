/**
 * DVPP zdarma — e-mailové sekvence (vlastní mailing, Resend) a jejich spouštění.
 *
 * Čtyři sekvence z kapitoly 7 strategie. Zakládají se přes `POST /admin/mailing/flows/seed-defaults`
 * jako neaktivní; texty jsou hotové, obsah se dá upravit v /mailing/automatizace.
 * HTML kroků se obaluje brand šablonou přímo tady (engine inline HTML neobaluje).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { enrollInFlows, type AutomationTriggerType } from '../automationEngine.ts';
import { EMAIL_FORCE_LIGHT_HEAD } from '../../../../../supabase/functions/_shared/email-force-light.ts';
import { buildVividbooksBrandShell } from '../../../../../supabase/functions/_shared/email-brand-shell.ts';

const SITE = 'https://dvppzdarma.cz';

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#333333;">${text}</p>`;
}
function cta(href: string, label: string): string {
  return `<p style="margin:6px 0 18px;"><a href="${href}" style="display:inline-block;background:#F06632;color:#ffffff;font-weight:800;font-size:15px;padding:13px 26px;border-radius:100px;text-decoration:none;">${label}</a></p>`;
}
const hi = 'Dobrý den {{first_name|učiteli}},';
/** Engine inline HTML kroků neobaluje — brand šablonu přidáme tady (stejná jako u webinářů). */
function wrap(subtitle: string, body: string): string {
  return buildVividbooksBrandShell({ title: 'DVPP zdarma', headerSubtitle: subtitle, content: body, headExtra: EMAIL_FORCE_LIGHT_HEAD });
}

export const DVPP_AUTOMATION_FLOWS: { name: string; slug: string; definition: Record<string, unknown> }[] = [
  {
    name: 'DVPP · uvítání v knihovně',
    slug: 'dvpp-uvitani',
    definition: {
      trigger: { type: 'dvpp_confirmed' },
      steps: [
        {
          key: 'd0-welcome', type: 'send_email',
          subject: 'Váš první certifikát DVPP je 45 minut daleko',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Vítejte v knihovně DVPP zdarma. Tři záznamy máte otevřené hned. Vyberte si ten, který se hodí do příští hodiny, pusťte si ho a po čtyřech otázkách k obsahu si stáhnete osvědčení DVPP s číslem, rozsahem hodin a lektorem.') + cta(`${SITE}/knihovna`, 'Otevřít knihovnu') + p('Tip: v kvízu „Jaký jste učitel“ (40 sekund) si zapnete doporučení podle vašich předmětů.')),
        },
        { key: 'wait-2d', type: 'wait', days: 2 },
        {
          key: 'd2-continue', type: 'send_email',
          subject: 'Rozkoukaný záznam čeká na dokončení',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('V knihovně je řádek „Pokračovat ve sledování“. Záznam se pustí tam, kde jste skončili, a osvědčení máte hned po dokončení dotazníku.') + cta(`${SITE}/knihovna`, 'Pokračovat ve sledování')),
        },
        { key: 'wait-3d', type: 'wait', days: 3 },
        {
          key: 'd5-invite', type: 'send_email',
          subject: 'Za jednoho kolegu máte celý rok záznamů',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Knihovna je dělaná pro sborovny. Když se přes váš odkaz přidá jeden kolega a pustí si záznam, máte všechny záznamy na celý školní rok. Když se přidá třetina sboru, má knihovnu zdarma celá škola.') + cta(`${SITE}/sborovna`, 'Otevřít sborovnu a zkopírovat odkaz') + p('Odkaz sdílíte sami, e-maily kolegů od vás nepotřebujeme.')),
        },
      ],
    },
  },
  {
    name: 'DVPP · po osvědčení',
    slug: 'dvpp-po-osvedceni',
    definition: {
      trigger: { type: 'dvpp_certificate' },
      steps: [
        {
          key: 'd0-cert', type: 'send_email',
          subject: 'Osvědčení DVPP máte na polici',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Osvědčení je uložené ve vašem účtu v knihovně, PDF si kdykoli stáhnete znovu. Ředitel ho může doložit do plánu DVPP i do šablon OP JAK.') + cta(`${SITE}/knihovna`, 'Zobrazit polici certifikátů') + p('Kolegům se bude hodit: pošlete jim odkaz na sborovnu. Za prvního kolegu máte celý rok záznamů.')),
        },
        { key: 'wait-3d', type: 'wait', days: 3 },
        {
          key: 'd3-next', type: 'send_email',
          subject: 'Další díl řady na vás čeká',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Záznamy jsou seřazené do řad po předmětech. Řada po 8 hodinách dává souhrnné osvědčení, které se školám dobře vykazuje.') + cta(`${SITE}/knihovna`, 'Otevřít knihovnu')),
        },
      ],
    },
  },
  {
    name: 'DVPP · přibyl kolega',
    slug: 'dvpp-pribyl-kolega',
    definition: {
      trigger: { type: 'dvpp_referral_confirmed' },
      steps: [
        {
          key: 'd0-colleague', type: 'send_email',
          subject: 'Přibyl vám kolega ve sborovně',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Někdo z vaší školy se přes váš odkaz přihlásil do knihovny. Jakmile si pustí první záznam, počítá se do milníku sborovny. Aktuální stav a kolik ještě chybí vidíte na stránce sborovny.') + cta(`${SITE}/sborovna`, 'Podívat se na sborovnu')),
        },
      ],
    },
  },
  {
    name: 'DVPP · sborovna odemčena',
    slug: 'dvpp-sborovna-odemcena',
    definition: {
      trigger: { type: 'dvpp_staffroom_unlocked' },
      steps: [
        {
          key: 'd0-unlocked', type: 'send_email',
          subject: 'Vaše sborovna má knihovnu zdarma',
          html: wrap('DVPP zdarma · knihovna', p(hi) + p('Povedlo se. Do sborovny se přidala třetina sboru a od teď mají všechny záznamy i osvědčení DVPP zdarma všichni učitelé ve škole, i ti, kteří se ještě nepřihlásili.') + cta(`${SITE}/knihovna`, 'Otevřít knihovnu') + p('Řekněte to ve sborovně. Každý kolega se přihlásí e-mailem a má hned všechno.')),
        },
      ],
    },
  },
];

/** Neblokující zařazení do sekvencí (chyby jen loguje). */
export async function enrollDvpp(sb: SupabaseClient, type: AutomationTriggerType, subscriberId: string): Promise<void> {
  try {
    await enrollInFlows(sb, { type }, subscriberId);
  } catch (e) {
    console.warn('[dvpp/automations] enroll', type, e instanceof Error ? e.message : e);
  }
}

export async function enrollDvppMany(sb: SupabaseClient, type: AutomationTriggerType, subscriberIds: string[]): Promise<void> {
  for (const id of subscriberIds) await enrollDvpp(sb, type, id);
}
