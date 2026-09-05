/**
 * /pro-reditele — školní kód pro celou sborovnu, výkaz hodin DVPP, BOZP (připravujeme).
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Award, FileText, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { dvppApi } from '../../utils/dvppApi';
import { DvppButton, DvppCard, DvppShell } from './DvppShell';
import { useDvppSession } from './DvppSession';
import { SchoolPicker } from './SchoolPicker';

type Report = Awaited<ReturnType<typeof dvppApi.staffroomReport>>;

export function DvppDirectorsPage() {
  const { me, loading, refresh } = useDvppSession();
  const [staffroom, setStaffroom] = useState<Awaited<ReturnType<typeof dvppApi.staffroom>> | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingTo, setPendingTo] = useState('');
  const [sp, setSp] = useSearchParams();
  const confirmToken = sp.get('confirm') || '';
  const [confirmInfo, setConfirmInfo] = useState<{ schoolName: string; requesterName: string } | null>(null);
  const [confirmState, setConfirmState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [confirmError, setConfirmError] = useState('');
  useEffect(() => {
    if (!confirmToken || confirmState === 'done') return;
    dvppApi.directorConfirmPreview(confirmToken)
      .then((r) => setConfirmInfo({ schoolName: r.schoolName, requesterName: r.requesterName }))
      .catch((e) => { setConfirmState('error'); setConfirmError(e instanceof Error ? e.message : 'Odkaz neplatí.'); });
  }, [confirmToken]);
  const confirmUnlock = async () => {
    setConfirmState('busy'); setConfirmError('');
    try {
      await dvppApi.directorConfirm(confirmToken);
      setConfirmState('done');
      /* Token je spotřebovaný: pryč z URL, ať reload nebo druhý klik z e-mailu neukáže „odkaz neplatí“. */
      setSp({}, { replace: true });
      await refresh(); await load();
    }
    catch (e) { setConfirmState('error'); setConfirmError(e instanceof Error ? e.message : 'Nepodařilo se potvrdit.'); }
  };

  const load = async () => {
    if (!me?.school) return;
    try { setStaffroom(await dvppApi.staffroom()); } catch { /* ignore */ }
    if (me.isDirector && me.directorVerified) { try { setReport(await dvppApi.staffroomReport()); } catch { /* ignore */ } }
  };
  useEffect(() => { if (!loading && me) void load(); }, [loading, me?.id, me?.school?.redIzo, me?.isDirector]);

  const becomeDirector = async () => {
    setBusy(true);
    try { await dvppApi.updateMe({ position: 'Ředitel/ka školy' }); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
  };
  const unlock = async () => {
    setBusy(true); setError('');
    try {
      const r = await dvppApi.directorUnlock();
      if (r.pending) setPendingTo(r.sentTo); else { await refresh(); await load(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
  };

  const unlocked = staffroom?.staffroom?.status === 'unlocked' || staffroom?.staffroom?.status === 'grace';

  return (
    <DvppShell title="Pro ředitele" description="Knihovna záznamů DVPP zdarma pro celou sborovnu jedním školním kódem. Výkaz hodin pro výroční zprávu a šablony." path="/pro-reditele">
      {confirmToken || confirmState === 'done' ? (
        <DvppCard className="mb-8 border-[#001161]/20">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#E8942A]">Potvrzení z e-mailu školy</p>
          {confirmState === 'done' ? (
            <>
              <h2 className="mb-1 text-[22px] font-extrabold text-[#001161]">Potvrzeno. Knihovna je odemčená pro celou školu.</h2>
              <p className="text-[14px] text-[#3a4270]">{confirmInfo?.requesterName || 'Žadatel'} teď v sekci Pro ředitele najde školní kód pro sborovnu.</p>
            </>
          ) : confirmState === 'error' ? (
            <>
              <h2 className="mb-1 text-[22px] font-extrabold text-[#001161]">Odkaz se nepodařilo potvrdit</h2>
              <p className="text-[14px] text-[#8a3a1f]">{confirmError}</p>
            </>
          ) : confirmInfo ? (
            <>
              <h2 className="mb-1 text-[22px] font-extrabold text-[#001161]">Odemknout knihovnu DVPP zdarma pro {confirmInfo.schoolName}?</h2>
              <p className="mb-4 text-[14px] text-[#3a4270]">{confirmInfo.requesterName} požádal/a jako vedení školy o odemknutí knihovny záznamů webinářů s osvědčením DVPP pro celou sborovnu. Je to zdarma a bez závazků. Potvrzením odemknete knihovnu všem učitelům školy.</p>
              <DvppButton onClick={() => void confirmUnlock()} disabled={confirmState === 'busy'}>{confirmState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Potvrdit a odemknout pro školu</DvppButton>
            </>
          ) : (
            <p className="text-[14px] text-[#6b7398]">Ověřujeme odkaz…</p>
          )}
        </DvppCard>
      ) : null}
      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#F06632]">Pro vedení školy</p>
          <h1 className="mb-3 text-[32px] font-extrabold leading-tight text-[#001161]">Celá sborovna má DVPP zdarma. Jedním kódem.</h1>
          <p className="mb-4 max-w-[62ch] text-[16px] text-[#3a4270]">Rozešlete sborovně školní kód a každý učitel má přístup ke stovce záznamů webinářů o výuce na ZŠ. Po krátkém ověření si vystaví osvědčení DVPP s číslem, rozsahem hodin a lektorem. Vy vidíte, kolik hodin sbor za rok nasbíral.</p>
          <ul className="grid gap-2 text-[14px] text-[#3a4270] sm:grid-cols-2">
            <li className="flex gap-2"><Award className="mt-0.5 h-4 w-4 shrink-0 text-[#F06632]" /> Osvědčení podle § 10 vyhl. 317/2005 Sb., vykazatelná v šablonách OP JAK (řady po 8 h)</li>
            <li className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#F06632]" /> Jeden kód pro školu, žádné faktury, žádné individuální registrace</li>
            <li className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#F06632]" /> Výkaz hodin DVPP sboru pro výroční zprávu a ČŠI</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F06632]" /> Připravujeme: e-learning BOZP a PO pro sborovnu v ceně</li>
          </ul>
        </div>
        <DvppCard>
          {!loading && !me ? (
            <>
              <h2 className="mb-1 text-[18px] font-extrabold text-[#001161]">Získat školní kód</h2>
              <p className="mb-3 text-[14px] text-[#3a4270]">Přihlaste se e-mailem (ideálně školním), vyberte školu a kód je váš.</p>
              <DvppButton to="/knihovna/prihlaseni?next=/pro-reditele" className="w-full">Přihlásit se jako vedení školy</DvppButton>
            </>
          ) : null}
          {me && !me.school ? (
            <>
              <h2 className="mb-1 text-[18px] font-extrabold text-[#001161]">Která škola?</h2>
              <SchoolPicker onPicked={async () => { await refresh(); await load(); }} position="Ředitel/ka školy" />
            </>
          ) : null}
          {me && me.school && !me.isDirector ? (
            <>
              <h2 className="mb-1 text-[18px] font-extrabold text-[#001161]">{me.school.name}</h2>
              <p className="mb-3 text-[14px] text-[#3a4270]">Váš profil má pozici „{me.position || 'učitel'}“. Školní kód vydáváme vedení školy.</p>
              <DvppButton onClick={() => void becomeDirector()} disabled={busy} variant="secondary" className="w-full">Jsem ředitel/ka nebo zástupce</DvppButton>
            </>
          ) : null}
          {me && me.school && me.isDirector ? (
            <>
              <h2 className="mb-1 text-[18px] font-extrabold text-[#001161]">{me.school.name}</h2>
              {unlocked && staffroom?.staffroom ? (
                <>
                  <p className="mb-2 text-[14px] text-[#3a4270]">Škola je odemčená. Rozešlete sborovně kód nebo odkaz:</p>
                  <p className="mb-1 rounded-xl bg-[#f6f7fb] px-3 py-2 text-center text-[22px] font-extrabold tracking-[.2em] text-[#001161]">{staffroom.staffroom.code}</p>
                  <p className="mb-3 break-all text-center text-[13px] text-[#6b7398]">dvppzdarma.cz/s/{staffroom.staffroom.code}</p>
                  <DvppButton to="/sborovna" variant="ghost" className="w-full">Sdílet a sledovat sborovnu</DvppButton>
                </>
              ) : (
                pendingTo ? (
                  <p className="rounded-xl bg-[#e8f5ee] px-3 py-3 text-[14px] text-[#1f5a3d]">Poslali jsme potvrzovací odkaz na oficiální e-mail školy z rejstříku ({pendingTo}). Jakmile ho někdo z vedení otevře, je knihovna odemčená pro celou školu. Odkaz platí 7 dní.</p>
                ) : (
                  <>
                    <p className="mb-3 text-[14px] text-[#3a4270]">Odemkněte knihovnu celé škole. Kód pak rozešlete sborovně sami, my kolegům nic neposíláme.</p>
                    {!me.directorVerified ? <p className="mb-3 text-[13px] text-[#6b7398]">Píšete ze soukromého e-mailu, proto pošleme potvrzovací odkaz na oficiální adresu školy z rejstříku. Se školním e-mailem se odemyká hned.</p> : null}
                    <DvppButton onClick={() => void unlock()} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Odemknout pro celou školu</DvppButton>
                  </>
                )
              )}
            </>
          ) : null}
          {error ? <p className="mt-3 text-[13px] text-[#b3261e]">{error}</p> : null}
        </DvppCard>
      </div>

      {me?.isDirector && me.directorVerified && report ? (
        <DvppCard>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[20px] font-extrabold text-[#001161]">Výkaz DVPP sboru za {new Date().getFullYear()}</h2>
            <span className="text-[13px] text-[#6b7398]">{report.totalCertificates} osvědčení · {report.totalHours} h</span>
          </div>
          {report.teachers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[14px]">
                <thead><tr className="text-left text-[12px] uppercase tracking-wide text-[#6b7398]"><th className="py-1">Učitel</th><th>Osvědčení</th><th>Hodin</th></tr></thead>
                <tbody>{report.teachers.map((t) => <tr key={t.email} className="border-t border-[#001161]/8"><td className="py-1.5">{t.name}</td><td className="tabular-nums">{t.certificates}</td><td className="tabular-nums">{t.hours}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="text-[14px] text-[#6b7398]">Zatím žádné osvědčení. Jakmile si učitelé vystaví první, objeví se tady.</p>}
          <p className="mt-3 text-[12px] text-[#6b7398]">Export do PDF a odkaz na šablonový výkaz připravujeme.</p>
        </DvppCard>
      ) : null}
    </DvppShell>
  );
}
