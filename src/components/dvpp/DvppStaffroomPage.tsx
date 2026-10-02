/**
 * /sborovna — dashboard sborovny: milník, členové, sdílení odkazu/kódu, vzkaz kolegovi, ředitelské odemknutí.
 */
import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, MessageSquare, Printer, QrCode, Send, Share2, Users } from 'lucide-react';
import { dvppApi, type DvppStaffroom } from '../../utils/dvppApi';
import { DvppButton, DvppCard, DvppShell, ProgressBar } from './DvppShell';
import { useDvppSession } from './DvppSession';
import { SchoolPicker } from './SchoolPicker';

function publicOrigin(): string {
  if (typeof window === 'undefined') return 'https://dvppzdarma.cz';
  const h = window.location.hostname.replace(/^www\./, '');
  return h === 'dvppzdarma.cz' || h === 'localhost' || h.endsWith('.vercel.app') ? window.location.origin : 'https://dvppzdarma.cz';
}

function statusLabel(s: string | undefined): { text: string; tone: string } {
  switch (s) {
    case 'unlocked': return { text: 'Odemčeno pro celou školu', tone: 'bg-[#e8f5ee] text-[#1f5a3d]' };
    case 'grace': return { text: 'Odemčeno · chybí kolega, máte 30 dní', tone: 'bg-[#fff4e0] text-[#7a4b00]' };
    case 'expired': return { text: 'Pozastaveno · přidejte kolegu', tone: 'bg-[#fde9df] text-[#8a3a1f]' };
    default: return { text: 'Sbíráme kolegy', tone: 'bg-[#efe8ff] text-[#3a2470]' };
  }
}

export function DvppStaffroomPage() {
  const { me, loading, refresh } = useDvppSession();
  const [data, setData] = useState<DvppStaffroom | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msgEmail, setMsgEmail] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgState, setMsgState] = useState<{ ok?: boolean; text?: string }>({});
  const [error, setError] = useState('');

  const load = async () => {
    try { setData(await dvppApi.staffroom()); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se načíst.'); }
  };
  useEffect(() => { if (!loading && me) void load(); }, [loading, me?.id, me?.school?.redIzo]);

  const create = async () => {
    setBusy(true);
    try { await dvppApi.createStaffroom(); await load(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
  };

  const shareUrl = data?.staffroom ? `${publicOrigin()}/s/${data.staffroom.code}` : '';
  const shareText = data?.school ? `Ahoj, na dvppzdarma.cz jsou záznamy webinářů s osvědčením DVPP zdarma. Když se nás z ${data.school.name} přidá třetina, má to zdarma celá sborovna. Tady je náš odkaz: ${shareUrl}` : shareUrl;

  const share = async (channel: string) => {
    void dvppApi.shareStaffroom(channel);
    if (channel === 'copy') {
      try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
    } else if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
    } else if (channel === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent('Záznamy DVPP zdarma pro naši sborovnu')}&body=${encodeURIComponent(shareText)}`;
    } else if (channel === 'native' && navigator.share) {
      try { await navigator.share({ title: 'DVPP zdarma pro naši sborovnu', text: shareText, url: shareUrl }); } catch { /* zrušeno */ }
    } else if (channel === 'print') {
      window.open(`/sborovna/letacek?code=${encodeURIComponent(data?.staffroom?.code || '')}`, '_blank', 'noopener');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgState({});
    setBusy(true);
    try {
      await dvppApi.messageColleague({ email: msgEmail, message: msgText });
      setMsgState({ ok: true, text: 'Vzkaz odešel. Kolega dostane jednu zprávu vaším jménem, žádnou reklamu ani připomínku.' });
      setMsgEmail(''); setMsgText('');
    } catch (err) {
      setMsgState({ ok: false, text: err instanceof Error ? err.message : 'Nepodařilo se odeslat.' });
    } finally { setBusy(false); }
  };

  const directorUnlock = async () => {
    setBusy(true);
    try { await dvppApi.directorUnlock(); await load(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
  };

  return (
    <DvppShell title="Sborovna" description="Pozvěte kolegy do knihovny DVPP zdarma. Když se přidá třetina sborovny, má záznamy zdarma celá škola." path="/sborovna">
      {!loading && !me ? (
        <DvppCard className="mx-auto max-w-[560px] text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-[#001161]" />
          <h1 className="mb-2 text-[24px] font-extrabold text-[#001161]">Sborovna je pro přihlášené</h1>
          <p className="mb-4 text-[15px] text-[#3a4270]">Přihlaste se e-mailem, vyberte školu a dostanete odkaz pro kolegy.</p>
          <DvppButton to="/knihovna/prihlaseni?next=/sborovna">Přihlásit se</DvppButton>
        </DvppCard>
      ) : null}

      {me && !me.school ? (
        <DvppCard className="mx-auto max-w-[640px]">
          <h1 className="mb-1 text-[24px] font-extrabold text-[#001161]">Kde učíte?</h1>
          <p className="mb-4 text-[15px] text-[#3a4270]">Vyberte školu z rejstříku. Podle velikosti sboru spočítáme, kolik kolegů stačí, aby měla knihovnu zdarma celá škola.</p>
          <SchoolPicker onPicked={async () => { await refresh(); await load(); }} />
        </DvppCard>
      ) : null}

      {me && me.school && data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <DvppCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7398]">Sborovna</p>
                  <h1 className="text-[24px] font-extrabold leading-tight text-[#001161]">{data.school?.name}</h1>
                  <p className="text-[13px] text-[#6b7398]">{data.school?.city}{data.school?.teachersCount ? ` · cca ${data.school.teachersCount} pedagogů${data.school.teachersEstimated ? ' (odhad)' : ''}` : ''}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusLabel(data.staffroom?.status).tone}`}>{statusLabel(data.staffroom?.status).text}</span>
              </div>
              {data.staffroom ? (
                <>
                  <ProgressBar value={data.confirmed} max={data.target} label="Potvrzení a aktivní kolegové" />
                  <p className="mt-3 text-[15px] text-[#3a4270]">
                    {data.staffroom.status === 'unlocked' || data.staffroom.status === 'grace'
                      ? <>Knihovnu má zdarma <strong className="text-[#001161]">celá škola</strong>. Každý kolega se přihlásí e-mailem a hned má všechny záznamy.</>
                      : <>Chybí <strong className="text-[#001161]">{data.missing}</strong> {data.missing === 1 ? 'kolega' : data.missing < 5 ? 'kolegové' : 'kolegů'}, aby měla záznamy zdarma celá škola. Kolega se počítá, když se přihlásí a pustí si první záznam.</>}
                  </p>
                  {data.colleaguesInBase > data.confirmed ? (
                    <p className="mt-2 rounded-xl bg-[#efe8ff] px-3 py-2 text-[13px] text-[#3a2470]">Tip: z vaší školy už máme v kontaktu {data.colleaguesInBase} lidí. Stačí, aby se přihlásili a přiřadili si školu.</p>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[15px] text-[#3a4270]">Založte sborovnu a dostanete odkaz pro kolegy. Vy se počítáte hned.</p>
                  <DvppButton onClick={() => void create()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Založit sborovnu</DvppButton>
                </div>
              )}
            </DvppCard>

            {data.staffroom ? (
              <DvppCard>
                <div className="mb-2 flex items-center gap-2"><Share2 className="h-5 w-5 text-[#F06632]" /><h2 className="text-[16px] font-extrabold text-[#001161]">Pošlete kolegům odkaz</h2></div>
                <p className="mb-3 text-[14px] text-[#3a4270]">Sdílíte ho sami, my e-maily kolegů neukládáme. Funguje ve školním chatu, na nástěnce i v e-mailu.</p>
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#001161]/15 bg-[#f6f7fb] px-3 py-2">
                  <code className="flex-1 truncate text-[14px] text-[#001161]">{shareUrl}</code>
                  <button type="button" onClick={() => void share('copy')} className="inline-flex items-center gap-1 rounded-full bg-[#001161] px-3 py-1.5 text-[12px] font-bold text-white">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Zkopírováno' : 'Kopírovat'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DvppButton variant="ghost" onClick={() => void share('whatsapp')}>WhatsApp</DvppButton>
                  <DvppButton variant="ghost" onClick={() => void share('email')}><Send className="h-4 w-4" /> E-mail</DvppButton>
                  {typeof navigator !== 'undefined' && 'share' in navigator ? <DvppButton variant="ghost" onClick={() => void share('native')}>Sdílet…</DvppButton> : null}
                  <DvppButton variant="ghost" onClick={() => void share('print')}><Printer className="h-4 w-4" /> Letáček s QR</DvppButton>
                </div>
                <p className="mt-3 text-[13px] text-[#6b7398]">Školní kód: <strong className="text-[#001161]">{data.staffroom.code}</strong> <QrCode className="inline h-3.5 w-3.5" /> (kolega ho zadá na dvppzdarma.cz)</p>
              </DvppCard>
            ) : null}

            {data.staffroom ? (
              <DvppCard>
                <div className="mb-2 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-[#001161]" /><h2 className="text-[16px] font-extrabold text-[#001161]">Vzkaz kolegovi</h2></div>
                <p className="mb-3 text-[14px] text-[#3a4270]">Pošleme jednu zprávu vaším jménem s vaším textem a odkazem. Bez reklamy, bez připomínky; adresu po 14 dnech mažeme. Nejvýš 10 vzkazů denně.</p>
                <form onSubmit={sendMessage} className="space-y-2">
                  <input type="email" required value={msgEmail} onChange={(e) => setMsgEmail(e.target.value)} placeholder="kolega@skola.cz" className="w-full rounded-xl border border-[#001161]/15 px-4 py-2.5 text-[14px] outline-none focus:border-[#001161]" />
                  <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} rows={3} maxLength={600} placeholder="Ahoj Petro, koukni na ten webinář o zlomcích, je fakt dobrý. Když se nás přidá pár, máme to celá sborovna zdarma." className="w-full rounded-xl border border-[#001161]/15 px-4 py-2.5 text-[14px] outline-none focus:border-[#001161]" />
                  <div className="flex items-center gap-3">
                    <DvppButton type="submit" variant="secondary" disabled={busy}><Send className="h-4 w-4" /> Poslat vzkaz</DvppButton>
                    {msgState.text ? <span className={`text-[13px] ${msgState.ok ? 'text-[#1f5a3d]' : 'text-[#b3261e]'}`}>{msgState.text}</span> : null}
                  </div>
                </form>
              </DvppCard>
            ) : null}
          </div>

          <aside className="space-y-4">
            {data.staffroom ? (
              <DvppCard>
                <h2 className="mb-2 text-[16px] font-extrabold text-[#001161]">Kdo už je ve sborovně</h2>
                <ul className="space-y-1.5">
                  {data.members.map((m, i) => (
                    <li key={i} className="flex items-center justify-between text-[14px]">
                      <span className="text-[#0d1440]">{m.firstName} {m.lastInitial ? `${m.lastInitial}.` : ''}{m.isMe ? ' (vy)' : ''}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.activated ? 'bg-[#e8f5ee] text-[#1f5a3d]' : 'bg-[#f0f2f8] text-[#6b7398]'}`}>{m.activated ? 'počítá se' : 'ještě nepustil záznam'}</span>
                    </li>
                  ))}
                </ul>
                {data.myReferred > 0 ? <p className="mt-3 text-[13px] text-[#3a4270]">Přivedli jste <strong>{data.myReferred}</strong> {data.myReferred === 1 ? 'kolegu' : 'kolegy'}. Máte celý školní rok záznamů.</p> : null}
              </DvppCard>
            ) : null}
            <DvppCard>
              <h2 className="mb-2 text-[16px] font-extrabold text-[#001161]">Jak se to počítá</h2>
              <ol className="list-decimal space-y-1 pl-5 text-[13px] text-[#3a4270]">
                <li>Kolega klikne na váš odkaz a přihlásí se e-mailem.</li>
                <li>Pustí si aspoň 3 minuty záznamu nebo si vystaví osvědčení.</li>
                <li>Milník je zhruba třetina sboru: {data.target} lidí pro vaši školu.</li>
                <li>Po splnění má knihovnu zdarma každý učitel školy, i ten, kdo se ještě nepřihlásil.</li>
              </ol>
            </DvppCard>
            {me.isDirector && data.staffroom?.status !== 'unlocked' ? (
              <DvppCard className="border-[#F06632]/40">
                <h2 className="mb-1 text-[16px] font-extrabold text-[#001161]">Jste vedení školy?</h2>
                <p className="mb-3 text-[13px] text-[#3a4270]">Ředitel nebo zástupce může knihovnu odemknout celé škole hned a rozeslat kód sborovně sám.</p>
                <DvppButton onClick={() => void directorUnlock()} disabled={busy} className="w-full">Odemknout pro celou školu</DvppButton>
              </DvppCard>
            ) : null}
          </aside>
        </div>
      ) : null}
      {error ? <p className="mt-6 rounded-xl bg-[#fde9df] px-4 py-3 text-[14px] text-[#8a3a1f]">{error}</p> : null}
    </DvppShell>
  );
}
