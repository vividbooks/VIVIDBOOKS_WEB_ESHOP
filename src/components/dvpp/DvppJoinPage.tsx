/**
 * /s/:code — vstup přes odkaz od kolegy nebo školní kód od ředitele.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2, Users } from 'lucide-react';
import { dvppApi } from '../../utils/dvppApi';
import { DvppButton, DvppCard, DvppShell, ProgressBar } from './DvppShell';
import { useDvppSession } from './DvppSession';

export function DvppJoinPage() {
  const { code = '' } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { me, loading, refresh } = useDvppSession();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof dvppApi.previewStaffroom>> | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    dvppApi.previewStaffroom(code).then(setPreview).catch((e) => setError(e instanceof Error ? e.message : 'Kód neznáme.'));
    void dvppApi.event('visit', { page: 'join', code, referral: sp.get('r') ? 'message' : 'link' });
  }, [code]);

  const join = async () => {
    setJoining(true);
    try {
      const r = await dvppApi.joinStaffroom(code);
      await refresh();
      navigate('/knihovna', { state: { joined: { code, schoolName: r.school.name } } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se přidat.'); } finally { setJoining(false); }
  };

  const title = preview?.school ? `Sborovna ${preview.school.name}` : 'Sborovna';
  return (
    <DvppShell title={title} description="Kolega vás zve do knihovny záznamů DVPP zdarma. Přihlaste se e-mailem a počítáte se do sborovny své školy." path={`/s/${code}`}>
      <div className="mx-auto max-w-[600px]">
        {error && !preview ? <DvppCard className="text-center text-[#8a3a1f]">{error}</DvppCard> : null}
        {preview ? (
          <DvppCard>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#F06632]">Pozvánka do sborovny</p>
            <h1 className="mb-1 text-[26px] font-extrabold leading-tight text-[#001161]">{preview.school?.name || 'Vaše škola'}</h1>
            <p className="mb-4 text-[15px] text-[#3a4270]">
              {preview.founderFirstName ? `${preview.founderFirstName} z vaší školy` : 'Kolega z vaší školy'} používá knihovnu záznamů webinářů s osvědčením DVPP. Když se přidá třetina sborovny, mají ji zdarma všichni učitelé školy.
            </p>
            <ProgressBar value={preview.confirmed} max={preview.target} label="Kolegové ve sborovně" />
            <ul className="my-5 space-y-1.5 text-[14px] text-[#3a4270]">
              <li>✓ Přihlášení e-mailem, bez hesla</li>
              <li>✓ Hned tři záznamy a osvědčení DVPP po krátkém ověření</li>
              <li>✓ Žádné platby, žádné závazky, odhlášení jedním klikem</li>
            </ul>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#001161]" /> : me ? (
              <DvppButton onClick={() => void join()} disabled={joining} className="w-full">{joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Přidat se ke sborovně</DvppButton>
            ) : (
              <DvppButton to={`/knihovna/prihlaseni?code=${encodeURIComponent(code)}&next=${encodeURIComponent('/knihovna')}`} className="w-full"><Users className="h-4 w-4" /> Přidat se e-mailem</DvppButton>
            )}
            {error && preview ? <p className="mt-3 text-[13px] text-[#b3261e]">{error}</p> : null}
          </DvppCard>
        ) : null}
      </div>
    </DvppShell>
  );
}
