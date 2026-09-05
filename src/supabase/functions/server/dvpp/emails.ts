/**
 * DVPP zdarma — HTML transakčních e-mailů (Mandrill), v brand šabloně jako ostatní webinářové maily.
 * Texty drží pravidla skillu vividbooks: užitek, konkrétnost, žádný nátlak.
 */
import { EMAIL_FORCE_LIGHT_HEAD } from '../../../../../supabase/functions/_shared/email-force-light.ts';
import { buildVividbooksBrandCta, buildVividbooksBrandShell } from '../../../../../supabase/functions/_shared/email-brand-shell.ts';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildLoginEmailHtml(opts: { firstName: string; loginUrl: string; isNew: boolean }): string {
  const hi = opts.firstName ? `Dobrý den, ${esc(opts.firstName)},` : 'Dobrý den,';
  const intro = opts.isNew
    ? 'Vítejte v knihovně DVPP zdarma. Kliknutím na tlačítko se přihlásíte a otevřou se vám záznamy webinářů, ke kterým si po krátkém ověření vystavíte osvědčení DVPP.'
    : 'Tady je váš přihlašovací odkaz do knihovny DVPP zdarma. Platí 24 hodin a funguje jen jednou.';
  return buildVividbooksBrandShell({
    title: 'Přihlášení do knihovny DVPP zdarma',
    headerSubtitle: 'DVPP zdarma · knihovna',
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#001161;line-height:1.25;">Váš vstup do knihovny</p>` +
      `<p style="margin:0 0 6px;font-size:16px;color:#4a5568;">${hi}</p>` +
      `<p style="margin:0 0 24px;font-size:16px;color:#4a5568;line-height:1.6;">${intro}</p>` +
      `<p style="margin:0 0 24px;">${buildVividbooksBrandCta(opts.loginUrl, 'Přihlásit se do knihovny')}</p>` +
      `<p style="margin:0 0 16px;font-size:13px;color:#718096;line-height:1.6;">Pokud tlačítko nefunguje, zkopírujte odkaz do prohlížeče:<br><span style="word-break:break-all;">${esc(opts.loginUrl)}</span></p>` +
      `<p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">Odkaz jste si nevyžádali? Nic se neděje, e-mail můžete ignorovat.</p>`,
  });
}

/**
 * „Vzkaz kolegovi“ — režim WP29: jménem odesílatele, bez marketingu, bez odměny, bez připomínky.
 */
export function buildColleagueEmailHtml(opts: { inviterName: string; schoolName: string; message: string; joinUrl: string }): string {
  const msg = opts.message ? `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #F06632;background:#fff4ee;border-radius:0 10px 10px 0;font-size:15px;color:#333;line-height:1.6;">${esc(opts.message).replace(/\n/g, '<br>')}</blockquote>` : '';
  return buildVividbooksBrandShell({
    title: `Vzkaz od ${opts.inviterName}`,
    headerSubtitle: `Sborovna ${opts.schoolName}`,
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#001161;line-height:1.25;">${esc(opts.inviterName)} vám posílá vzkaz</p>` +
      `<p style="margin:0 0 18px;font-size:16px;color:#4a5568;line-height:1.6;">Vaše kolegyně nebo kolega ze školy <strong style="color:#001161;">${esc(opts.schoolName)}</strong> používá knihovnu záznamů DVPP zdarma a chce vás pozvat do sborovny.</p>` +
      msg +
      `<p style="margin:0 0 20px;">${buildVividbooksBrandCta(opts.joinUrl, 'Podívat se, o co jde')}</p>` +
      `<p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">Tenhle e-mail odešel jednorázově na přání ${esc(opts.inviterName)}. Vaši adresu neukládáme a další zprávu nepošleme, dokud se sami nepřihlásíte.</p>`,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Odesláno přes dvppzdarma.cz (Vividbooks s.r.o.) jménem ${esc(opts.inviterName)}.</p>`,
  });
}

export function buildMilestoneEmailHtml(opts: { firstName: string; schoolName: string; libraryUrl: string }): string {
  return buildVividbooksBrandShell({
    title: 'Sborovna má knihovnu zdarma',
    headerSubtitle: 'DVPP zdarma · sborovna',
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#001161;line-height:1.25;">Povedlo se: ${esc(opts.schoolName)} má knihovnu zdarma</p>` +
      `<p style="margin:0 0 18px;font-size:16px;color:#4a5568;line-height:1.6;">${opts.firstName ? `${esc(opts.firstName)}, ` : ''}do sborovny se přidala třetina sboru. Od teď mají všechny záznamy a osvědčení DVPP zdarma všichni učitelé ve škole.</p>` +
      `<p style="margin:0;">${buildVividbooksBrandCta(opts.libraryUrl, 'Otevřít knihovnu')}</p>`,
  });
}

/** Potvrzení ředitelského odemknutí — jde na oficiální e-mail školy z rejstříku, ne žadateli. */
export function buildDirectorConfirmEmailHtml(opts: { requesterName: string; requesterEmail: string; schoolName: string; confirmUrl: string }): string {
  return buildVividbooksBrandShell({
    title: 'Potvrzení: knihovna DVPP zdarma pro celou školu',
    headerSubtitle: 'DVPP zdarma · pro vedení školy',
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#001161;line-height:1.25;">Odemknout knihovnu záznamů pro ${esc(opts.schoolName)}?</p>` +
      `<p style="margin:0 0 12px;font-size:16px;color:#4a5568;line-height:1.6;">${esc(opts.requesterName || opts.requesterEmail)} (${esc(opts.requesterEmail)}) požádal/a jako vedení školy o odemknutí knihovny záznamů webinářů s osvědčením DVPP pro celou sborovnu. Je to zdarma a bez závazků.</p>` +
      `<p style="margin:0 0 18px;font-size:16px;color:#4a5568;line-height:1.6;">Tento e-mail jsme poslali na adresu školy z rejstříku MŠMT, aby o odemknutí rozhodlo vedení školy. Pokud žádost neznáte, nic nedělejte; odkaz platí 7 dní.</p>` +
      `<p style="margin:0;">${buildVividbooksBrandCta(opts.confirmUrl, 'Potvrdit a odemknout pro školu')}</p>`,
  });
}
