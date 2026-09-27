/**
 * Měření studentského programu: úspěšnost univerzit a používání aplikace.
 * Čistá logika bez I/O (testy v scripts/run-unit-tests.ts).
 *
 * Zdroje:
 *  - `student_program_students` (web /studenti od 27. 9. 2026 a importované kontakty),
 *  - Kabinet `/student-usage` s `all: true` — všechny organizace kind `student`, i ty ze
 *    starého Webflow formuláře, s konce licence a používáním nové aplikace (`cs_activity_log`).
 * Osoba se páruje podle učitelského kódu, jinak zůstane jen z webu. Univerzita se bere
 * z fakulty (web), jinak z domény e-mailu.
 */
import { matchUniversityEmail } from '../../../../supabase/functions/_shared/student-program-faculties.ts';

export type KabinetStudentUsage = {
  firstOn: string | null;
  lastOn: string | null;
  activeDays: number;
  activeDays30: number;
  actions: Record<string, number>;
  actions30: Record<string, number>;
  subjects: string[];
  pupilDays: number;
};

export type KabinetStudent = {
  teacherCode: string;
  email: string | null;
  name: string | null;
  createdAt: string | null;
  accessUntil: string | null;
  usage: KabinetStudentUsage | null;
};

export type MeasurementWebStudent = {
  id: string;
  status: string;
  faculty_id: string | null;
  university_email: string;
  first_name?: string | null;
  last_name?: string | null;
  teacher_code: string | null;
  created_at?: string | null;
  verified_at?: string | null;
  renewal_count?: number | null;
  access_valid_until?: string | null;
  access_extended_until?: string | null;
  employer_status?: string | null;
};

export type MeasurementFaculty = {
  id: string;
  university: string;
  university_short: string;
  faculty_short: string;
  kind: string;
  estimated_students: number | null;
};

export type MeasurementRow = {
  key: string;
  label: string;
  university: string;
  /** Registrace na webu, které ještě neověřily e-mail (u starých studentů z Kabinetu nevíme). */
  pending: number;
  /** Studenti s přihlašovacím kódem. */
  withAccess: number;
  /** Přístup platí dnes. */
  accessActive: number;
  /** Aspoň jednou v nové aplikaci. */
  activated: number;
  /** Něco dělali v posledních 30 dnech. */
  active30: number;
  /** Aspoň 5 dní s aktivitou. */
  regular: number;
  /** Použili materiály se žáky (aktivita pod žákovským kódem). */
  withPupils: number;
  lessonsOpened: number;
  lessonsPresented: number;
  worksheetsPrinted: number;
  renewed: number;
  estimatedStudents: number | null;
  activationRate: number | null;
  active30Rate: number | null;
  /** Studenti s přístupem na 100 odhadovaných studentů učitelství (jen PedF odhady). */
  penetration: number | null;
};

export type StudentMeasurement = {
  generatedAt: string;
  kabinetOk: boolean;
  kabinetError: string | null;
  totals: MeasurementRow;
  universities: MeasurementRow[];
  subjects: Array<{ subject: string; students: number }>;
  months: Array<{ month: string; newAccess: number; activated: number }>;
  topStudents: Array<{ name: string; university: string; activeDays: number; activeDays30: number; lastOn: string | null; lessonsOpened: number; pupilDays: number; subjects: string[] }>;
  neverActivated: { count: number; olderThan14Days: number };
  sources: { web: number; kabinet: number; matched: number };
};

type Person = {
  key: string;
  name: string;
  universityKey: string;
  universityLabel: string;
  university: string;
  pending: boolean;
  hasAccess: boolean;
  accessUntil: string | null;
  createdAt: string | null;
  renewed: boolean;
  usage: KabinetStudentUsage | null;
};

/**
 * `subject` v `cs_activity_log` je nejednotný: „Matematika (2. stupeň)“, „Fyzika“, ale i slugy
 * knih („prvouka-1-rocnik-1-dil“, „6-rocnik-1-dil“). Bereme jen to, z čeho je předmět poznat.
 */
export function normalizeSubject(raw: string | null | undefined): string | null {
  const t = String(raw || '').toLowerCase();
  if (!t) return null;
  if (t.includes('matemat')) return 'Matematika';
  if (t.includes('fyzik')) return 'Fyzika';
  if (t.includes('chemi')) return 'Chemie';
  if (t.includes('přírodopis') || t.includes('prirodopis')) return 'Přírodopis';
  if (t.includes('prvouk')) return 'Prvouka';
  if (t.includes('český jazyk') || t.includes('cesky-jazyk') || t.includes('čeština') || t.includes('cestina')) return 'Český jazyk';
  return null;
}

function personSubjects(u: KabinetStudentUsage | null): string[] {
  const out: string[] = [];
  for (const raw of u?.subjects ?? []) {
    const n = normalizeSubject(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

const UNKNOWN = { key: '_none', label: 'Nezařazeno', university: 'E-mail mimo známé univerzity' };

/** „Student univerzity: Jana Nová (PdF MU)“ → „Jana Nová“. */
function kabinetName(name: string | null | undefined): string {
  return String(name || '').replace(/^Student univerzity:\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function emptyRow(key: string, label: string, university: string): MeasurementRow {
  return {
    key, label, university,
    pending: 0, withAccess: 0, accessActive: 0, activated: 0, active30: 0, regular: 0, withPupils: 0,
    lessonsOpened: 0, lessonsPresented: 0, worksheetsPrinted: 0, renewed: 0,
    estimatedStudents: null, activationRate: null, active30Rate: null, penetration: null,
  };
}

function addPerson(row: MeasurementRow, p: Person, today: string): void {
  if (p.pending) {
    row.pending += 1;
    return;
  }
  if (!p.hasAccess) return;
  row.withAccess += 1;
  if (p.accessUntil && p.accessUntil >= today) row.accessActive += 1;
  if (p.renewed) row.renewed += 1;
  const u = p.usage;
  if (!u || !u.activeDays) return;
  row.activated += 1;
  if (u.activeDays30 > 0) row.active30 += 1;
  if (u.activeDays >= 5) row.regular += 1;
  if (u.pupilDays > 0) row.withPupils += 1;
  row.lessonsOpened += u.actions.library_lesson_opened || 0;
  row.lessonsPresented += u.actions.lesson_presented || 0;
  row.worksheetsPrinted += u.actions.worksheet_printed || 0;
}

function finishRow(row: MeasurementRow): MeasurementRow {
  row.activationRate = pct(row.activated, row.withAccess);
  row.active30Rate = pct(row.active30, row.withAccess);
  row.penetration = row.estimatedStudents ? Math.round((row.withAccess / row.estimatedStudents) * 1000) / 10 : null;
  return row;
}

function monthOf(iso: string | null | undefined): string {
  return String(iso || '').slice(0, 7);
}

export function buildStudentMeasurement(input: {
  webStudents: MeasurementWebStudent[];
  faculties: MeasurementFaculty[];
  kabinet: KabinetStudent[] | null;
  kabinetError?: string | null;
  today: string;
  now?: string;
}): StudentMeasurement {
  const { webStudents, faculties, today } = input;
  const kabinet = input.kabinet ?? [];
  const facById = new Map(faculties.map((f) => [f.id, f]));
  const byCode = new Map(kabinet.map((k) => [k.teacherCode.toUpperCase(), k]));

  const universityOf = (facultyId: string | null, email: string | null): { key: string; label: string; university: string } => {
    const fac = facultyId ? facById.get(facultyId) : null;
    if (fac) return { key: fac.university_short, label: fac.university_short, university: fac.university };
    const hit = email ? matchUniversityEmail(email) : null;
    if (hit) return { key: hit.universityShort, label: hit.universityShort, university: hit.university };
    return UNKNOWN;
  };

  const people: Person[] = [];
  const usedCodes = new Set<string>();
  for (const s of webStudents) {
    if (s.status === 'declined' || s.status === 'unsubscribed') continue;
    const code = String(s.teacher_code || '').toUpperCase();
    const k = code ? byCode.get(code) : undefined;
    if (k) usedCodes.add(code);
    const uni = universityOf(s.faculty_id, s.university_email);
    const webUntil = [s.access_valid_until, s.access_extended_until].filter(Boolean).sort().pop() || null;
    people.push({
      key: s.id,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || kabinetName(k?.name) || s.university_email,
      universityKey: uni.key,
      universityLabel: uni.label,
      university: uni.university,
      pending: s.status === 'pending',
      hasAccess: s.status !== 'pending' && !!code,
      accessUntil: k?.accessUntil ?? webUntil,
      createdAt: s.verified_at || s.created_at || null,
      renewed: (Number(s.renewal_count) || 0) > 0,
      usage: k?.usage ?? null,
    });
  }
  for (const k of kabinet) {
    if (usedCodes.has(k.teacherCode.toUpperCase())) continue;
    const uni = universityOf(null, k.email);
    people.push({
      key: k.teacherCode,
      name: kabinetName(k.name) || k.teacherCode,
      universityKey: uni.key,
      universityLabel: uni.label,
      university: uni.university,
      pending: false,
      hasAccess: true,
      accessUntil: k.accessUntil,
      createdAt: k.createdAt,
      renewed: false,
      usage: k.usage,
    });
  }

  const estimated = new Map<string, number>();
  for (const f of faculties) {
    if (f.kind !== 'pedf' || !f.estimated_students) continue;
    estimated.set(f.university_short, (estimated.get(f.university_short) || 0) + f.estimated_students);
  }

  const rows = new Map<string, MeasurementRow>();
  const totals = emptyRow('_total', 'Celkem', 'Všechny univerzity');
  for (const f of faculties) {
    if (!rows.has(f.university_short)) rows.set(f.university_short, emptyRow(f.university_short, f.university_short, f.university));
  }
  for (const p of people) {
    let row = rows.get(p.universityKey);
    if (!row) {
      row = emptyRow(p.universityKey, p.universityLabel, p.university);
      rows.set(p.universityKey, row);
    }
    addPerson(row, p, today);
    addPerson(totals, p, today);
  }
  for (const [key, row] of rows) row.estimatedStudents = estimated.get(key) ?? null;
  totals.estimatedStudents = [...estimated.values()].reduce((a, b) => a + b, 0) || null;

  const universities = [...rows.values()]
    .map(finishRow)
    .sort((a, b) => b.active30 - a.active30 || b.activated - a.activated || b.withAccess - a.withAccess || a.label.localeCompare(b.label, 'cs'));

  const subjectCount = new Map<string, number>();
  for (const p of people) for (const subj of personSubjects(p.usage)) subjectCount.set(subj, (subjectCount.get(subj) || 0) + 1);

  const months: StudentMeasurement['months'] = [];
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 11);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    months.push({ month: d.toISOString().slice(0, 7), newAccess: 0, activated: 0 });
  }
  const monthIdx = new Map(months.map((m, i) => [m.month, i]));
  for (const p of people) {
    if (!p.hasAccess) continue;
    const a = monthIdx.get(monthOf(p.createdAt));
    if (a != null) months[a].newAccess += 1;
    const b = monthIdx.get(monthOf(p.usage?.firstOn));
    if (b != null) months[b].activated += 1;
  }

  const topStudents = people
    .filter((p) => p.usage && p.usage.activeDays > 0)
    .sort((a, b) => (b.usage!.activeDays30 - a.usage!.activeDays30) || (b.usage!.activeDays - a.usage!.activeDays) || String(b.usage!.lastOn).localeCompare(String(a.usage!.lastOn)))
    .slice(0, 20)
    .map((p) => ({
      name: p.name,
      university: p.universityLabel,
      activeDays: p.usage!.activeDays,
      activeDays30: p.usage!.activeDays30,
      lastOn: p.usage!.lastOn,
      lessonsOpened: p.usage!.actions.library_lesson_opened || 0,
      pupilDays: p.usage!.pupilDays,
      subjects: personSubjects(p.usage).slice(0, 3),
    }));

  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 14);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const never = people.filter((p) => p.hasAccess && !(p.usage && p.usage.activeDays > 0));

  return {
    generatedAt: input.now ?? new Date().toISOString(),
    kabinetOk: input.kabinet != null,
    kabinetError: input.kabinetError ?? null,
    totals: finishRow(totals),
    universities,
    subjects: [...subjectCount.entries()].sort((a, b) => b[1] - a[1]).map(([subject, students]) => ({ subject, students })),
    months,
    topStudents,
    neverActivated: { count: never.length, olderThan14Days: never.filter((p) => p.createdAt && p.createdAt.slice(0, 10) <= cutoffIso).length },
    sources: { web: webStudents.length, kabinet: kabinet.length, matched: usedCodes.size },
  };
}
