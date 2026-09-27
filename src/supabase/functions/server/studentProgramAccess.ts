/**
 * Studentský program ↔ Kabinet: čistá logika bez I/O (testy v scripts/run-unit-tests.ts).
 *
 * Přístup zakládá hook Kabinetu `POST /api/registr/hooks/web/student-access`:
 * vlastní „škola“ studenta ve starém systému + individuální roční licence na všechny
 * předměty. Žádný trial, žádný obchod v Pipedrive. Detail: docs/STUDENT_PROGRAM.md.
 */

export type StudentAccessStudent = {
  university_email: string;
  personal_email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  teacher_code?: string | null;
  codes_valid_until?: string | null;
  access_valid_until?: string | null;
};

/** ISO datum + N měsíců (přetečení dne srovná na konec měsíce). */
export function addMonthsIsoDay(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, d));
  if (target.getUTCMonth() !== (((m - 1 + months) % 12) + 12) % 12) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** Obnova navazuje na současný konec; když už skončil, začíná dnes. */
export function renewalStartsOn(s: Pick<StudentAccessStudent, 'codes_valid_until' | 'access_valid_until'>, today: string): string {
  const current = s.codes_valid_until || s.access_valid_until || today;
  return current > today ? current : today;
}

/** Tělo hooku `/student-access`. S `renew` posílá kód studenta (obnova), jinak zakládá. */
export function studentAccessRequest(
  s: StudentAccessStudent,
  facultyName: string | null,
  startsOn: string,
  months: number,
  renew = false,
): Record<string, string> {
  const body: Record<string, string> = {
    universityEmail: s.university_email.trim().toLowerCase(),
    personalEmail: String(s.personal_email || '').trim().toLowerCase(),
    firstName: String(s.first_name || '').trim() || 'Student',
    lastName: String(s.last_name || '').trim() || 'Vividbooks',
    faculty: String(facultyName || '').trim(),
    startsOn,
    endsOn: addMonthsIsoDay(startsOn, Math.max(1, months || 12)),
  };
  if (renew && s.teacher_code) body.teacherCode = s.teacher_code;
  return body;
}

export type StudentAccessOutcome =
  | { ok: true; action: string; teacherCode: string; studentCode: string | null; endsOn: string }
  | { ok: false; reason: string };

/** Odpověď hooku → co uložit ke studentovi. Bez kódu nebo konce licence to není úspěch. */
export function interpretStudentAccess(status: number, body: Record<string, unknown> | null, text: string): StudentAccessOutcome {
  const teacherCode = typeof body?.teacherCode === 'string' ? body.teacherCode.trim().toUpperCase() : '';
  const studentCode = typeof body?.studentCode === 'string' && body.studentCode.trim() ? body.studentCode.trim().toUpperCase() : null;
  const endsOn = typeof body?.endsOn === 'string' ? body.endsOn.slice(0, 10) : '';
  if (status >= 200 && status < 300 && body?.ok === true && teacherCode && endsOn) {
    return { ok: true, action: String(body.action || ''), teacherCode, studentCode, endsOn };
  }
  const code = typeof body?.code === 'string' ? body.code : '';
  const error = typeof body?.error === 'string' ? body.error : typeof body?.errors === 'string' ? body.errors : '';
  const where = status ? `HTTP ${status}` : 'síť';
  return { ok: false, reason: `${where}${code ? ` ${code}` : ''}: ${error || text.slice(0, 200) || 'bez odpovědi'}`.slice(0, 300) };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Kód do e-mailu: jen učitelský. Žákovský kód se v e-mailech ani po ověření neukazuje,
 * student ho najde na stránce „Můj přístup“ (/studenti/aktualizace).
 */
export function teacherCodeEmailBlock(teacherCode: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="padding:6px;"><div style="border:1px solid rgba(0,17,97,0.12);border-radius:14px;padding:12px 16px;background:#fbfbfd;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,17,97,0.5);margin-bottom:4px;">Váš přihlašovací kód</div>
<div style="font-family:Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:#001161;letter-spacing:0.06em;">${escHtml(teacherCode)}</div>
</div></td></tr></table>`;
}

/** Návod k přihlášení (e-mail po ověření i po obnově). */
export const TEACHER_LOGIN_STEPS_HTML =
  '<strong>Jak se přihlásit:</strong> otevřete aplikaci, zvolte <em>Přihlásit se kódem školy</em>, zadejte kód výše a svůj e-mail. Pak si účet zabezpečte heslem nebo Googlem — odemkne se <em>Můj obsah</em> pro vlastní přípravy.';
