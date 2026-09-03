/**
 * Studentský program Vividbooks — seznam fakult v ČR, které připravují učitele
 * (základ = 9 pedagogických fakult, doplněk = fakulty s učitelskými programy).
 *
 * Sdílí se mezi webem (`/studenti`, admin) a Edge funkcí `make-server-93a20b6f`
 * (seed tabulky `student_program_faculties`, detekce univerzitního e-mailu).
 * Soubor nesmí importovat nic z Deno ani z Vite — čistý TypeScript.
 *
 * Čísla studentů jsou **odhady** pro plánování pokrytí; v adminu se dají přepsat.
 */

export type StudentProgramFacultyKind = 'pedf' | 'other';

export interface StudentProgramFaculty {
  /** Stabilní slug — primární klíč v DB (`uk-pedf`). */
  id: string;
  university: string;
  universityShort: string;
  faculty: string;
  facultyShort: string;
  city: string;
  region: string;
  /** IČO univerzity (fakulty nemají vlastní). 8 číslic. */
  ico: string;
  /** Kořenové domény univerzity — e-mail se bere jako univerzitní, když je doména shodná nebo subdoména. */
  emailDomains: string[];
  kind: StudentProgramFacultyKind;
  website: string;
  /** Odhad počtu studentů učitelských programů (jen pro plánování pokrytí). */
  estimatedStudents: number | null;
  note?: string;
}

type UniversityDef = {
  university: string;
  short: string;
  ico: string;
  domains: string[];
  city: string;
  region: string;
};

const U: Record<string, UniversityDef> = {
  uk: { university: 'Univerzita Karlova', short: 'UK', ico: '00216208', domains: ['cuni.cz'], city: 'Praha', region: 'Praha' },
  mu: { university: 'Masarykova univerzita', short: 'MU', ico: '00216224', domains: ['muni.cz'], city: 'Brno', region: 'Jihomoravský' },
  upol: { university: 'Univerzita Palackého v Olomouci', short: 'UP', ico: '61989592', domains: ['upol.cz'], city: 'Olomouc', region: 'Olomoucký' },
  jcu: { university: 'Jihočeská univerzita v Českých Budějovicích', short: 'JU', ico: '60076658', domains: ['jcu.cz'], city: 'České Budějovice', region: 'Jihočeský' },
  zcu: { university: 'Západočeská univerzita v Plzni', short: 'ZČU', ico: '49777513', domains: ['zcu.cz'], city: 'Plzeň', region: 'Plzeňský' },
  ujep: { university: 'Univerzita Jana Evangelisty Purkyně v Ústí nad Labem', short: 'UJEP', ico: '44555601', domains: ['ujep.cz'], city: 'Ústí nad Labem', region: 'Ústecký' },
  uhk: { university: 'Univerzita Hradec Králové', short: 'UHK', ico: '62690094', domains: ['uhk.cz'], city: 'Hradec Králové', region: 'Královéhradecký' },
  osu: { university: 'Ostravská univerzita', short: 'OU', ico: '61988987', domains: ['osu.cz'], city: 'Ostrava', region: 'Moravskoslezský' },
  tul: { university: 'Technická univerzita v Liberci', short: 'TUL', ico: '46747885', domains: ['tul.cz'], city: 'Liberec', region: 'Liberecký' },
  slu: { university: 'Slezská univerzita v Opavě', short: 'SU', ico: '47813059', domains: ['slu.cz'], city: 'Opava', region: 'Moravskoslezský' },
  utb: { university: 'Univerzita Tomáše Bati ve Zlíně', short: 'UTB', ico: '70883521', domains: ['utb.cz'], city: 'Zlín', region: 'Zlínský' },
  upce: { university: 'Univerzita Pardubice', short: 'UPa', ico: '00216275', domains: ['upce.cz'], city: 'Pardubice', region: 'Pardubický' },
  czu: { university: 'Česká zemědělská univerzita v Praze', short: 'ČZU', ico: '60460709', domains: ['czu.cz'], city: 'Praha', region: 'Praha' },
  vscht: { university: 'Vysoká škola chemicko-technologická v Praze', short: 'VŠCHT', ico: '60461373', domains: ['vscht.cz'], city: 'Praha', region: 'Praha' },
  cvut: { university: 'České vysoké učení technické v Praze', short: 'ČVUT', ico: '68407700', domains: ['cvut.cz'], city: 'Praha', region: 'Praha' },
  mendelu: { university: 'Mendelova univerzita v Brně', short: 'MENDELU', ico: '62156489', domains: ['mendelu.cz'], city: 'Brno', region: 'Jihomoravský' },
};

function f(
  uni: keyof typeof U,
  id: string,
  faculty: string,
  facultyShort: string,
  kind: StudentProgramFacultyKind,
  website: string,
  estimatedStudents: number | null,
  note?: string,
): StudentProgramFaculty {
  const u = U[uni];
  return {
    id,
    university: u.university,
    universityShort: u.short,
    faculty,
    facultyShort,
    city: u.city,
    region: u.region,
    ico: u.ico,
    emailDomains: u.domains,
    kind,
    website,
    estimatedStudents,
    ...(note ? { note } : {}),
  };
}

/**
 * Pořadí: nejdřív 9 pedagogických fakult (jádro programu), potom ostatní
 * fakulty s učitelskými programy (2. stupeň ZŠ / SŠ), řazené podle univerzity.
 */
export const STUDENT_PROGRAM_FACULTIES: StudentProgramFaculty[] = [
  // ── 9 pedagogických fakult ────────────────────────────────────────────────
  f('uk', 'uk-pedf', 'Pedagogická fakulta', 'PedF UK', 'pedf', 'https://pedf.cuni.cz', 4800, 'Největší PedF v ČR; učitelství 1. i 2. stupně.'),
  f('mu', 'mu-pdf', 'Pedagogická fakulta', 'PdF MU', 'pedf', 'https://www.ped.muni.cz', 4300),
  f('upol', 'upol-pdf', 'Pedagogická fakulta', 'PdF UP', 'pedf', 'https://www.pdf.upol.cz', 4200),
  f('jcu', 'jcu-pf', 'Pedagogická fakulta', 'PF JU', 'pedf', 'https://www.pf.jcu.cz', 2400),
  f('zcu', 'zcu-fpe', 'Fakulta pedagogická', 'FPE ZČU', 'pedf', 'https://fpe.zcu.cz', 1900),
  f('ujep', 'ujep-pf', 'Pedagogická fakulta', 'PF UJEP', 'pedf', 'https://www.pf.ujep.cz', 2300),
  f('uhk', 'uhk-pdf', 'Pedagogická fakulta', 'PdF UHK', 'pedf', 'https://www.uhk.cz/cs/pedagogicka-fakulta', 2300),
  f('osu', 'osu-pdf', 'Pedagogická fakulta', 'PdF OU', 'pedf', 'https://pdf.osu.cz', 2400),
  f('tul', 'tul-fp', 'Fakulta přírodovědně-humanitní a pedagogická', 'FP TUL', 'pedf', 'https://www.fp.tul.cz', 1800),

  // ── Další fakulty s učitelskými programy ──────────────────────────────────
  f('uk', 'uk-mff', 'Matematicko-fyzikální fakulta', 'MFF UK', 'other', 'https://www.mff.cuni.cz', 400, 'Učitelství matematiky, fyziky, informatiky.'),
  f('uk', 'uk-prf', 'Přírodovědecká fakulta', 'PřF UK', 'other', 'https://www.natur.cuni.cz', 400, 'Učitelství biologie, chemie, geografie.'),
  f('uk', 'uk-ff', 'Filozofická fakulta', 'FF UK', 'other', 'https://www.ff.cuni.cz', 300, 'Učitelství ČJ, cizích jazyků, dějepisu.'),
  f('uk', 'uk-ftvs', 'Fakulta tělesné výchovy a sportu', 'FTVS UK', 'other', 'https://ftvs.cuni.cz', 300),
  f('mu', 'mu-prf', 'Přírodovědecká fakulta', 'PřF MU', 'other', 'https://www.sci.muni.cz', 400),
  f('mu', 'mu-ff', 'Filozofická fakulta', 'FF MU', 'other', 'https://www.phil.muni.cz', 300),
  f('mu', 'mu-fsps', 'Fakulta sportovních studií', 'FSpS MU', 'other', 'https://www.fsps.muni.cz', 200),
  f('upol', 'upol-prf', 'Přírodovědecká fakulta', 'PřF UP', 'other', 'https://www.prf.upol.cz', 400),
  f('upol', 'upol-ff', 'Filozofická fakulta', 'FF UP', 'other', 'https://www.ff.upol.cz', 300),
  f('upol', 'upol-ftk', 'Fakulta tělesné kultury', 'FTK UP', 'other', 'https://ftk.upol.cz', 200),
  f('upol', 'upol-cmtf', 'Cyrilometodějská teologická fakulta', 'CMTF UP', 'other', 'https://www.cmtf.upol.cz', 100),
  f('jcu', 'jcu-prf', 'Přírodovědecká fakulta', 'PřF JU', 'other', 'https://www.prf.jcu.cz', 200),
  f('jcu', 'jcu-ff', 'Filozofická fakulta', 'FF JU', 'other', 'https://www.ff.jcu.cz', 150),
  f('jcu', 'jcu-tf', 'Teologická fakulta', 'TF JU', 'other', 'https://www.tf.jcu.cz', 100),
  f('zcu', 'zcu-ff', 'Fakulta filozofická', 'FF ZČU', 'other', 'https://ff.zcu.cz', 100),
  f('ujep', 'ujep-prf', 'Přírodovědecká fakulta', 'PřF UJEP', 'other', 'https://prf.ujep.cz', 200, 'Učitelství STEM pro 2. stupeň ZŠ.'),
  f('ujep', 'ujep-ff', 'Filozofická fakulta', 'FF UJEP', 'other', 'https://ff.ujep.cz', 150),
  f('uhk', 'uhk-prf', 'Přírodovědecká fakulta', 'PřF UHK', 'other', 'https://www.uhk.cz/cs/prirodovedecka-fakulta', 200),
  f('uhk', 'uhk-ff', 'Filozofická fakulta', 'FF UHK', 'other', 'https://www.uhk.cz/cs/filozoficka-fakulta', 150),
  f('osu', 'osu-prf', 'Přírodovědecká fakulta', 'PřF OU', 'other', 'https://prf.osu.cz', 200),
  f('osu', 'osu-ff', 'Filozofická fakulta', 'FF OU', 'other', 'https://ff.osu.cz', 150),
  f('slu', 'slu-fpf', 'Filozoficko-přírodovědecká fakulta', 'FPF SU', 'other', 'https://www.slu.cz/fpf', 150),
  f('utb', 'utb-fhs', 'Fakulta humanitních studií', 'FHS UTB', 'other', 'https://fhs.utb.cz', 300, 'Učitelství pro 1. stupeň ZŠ, MŠ.'),
  f('upce', 'upce-ff', 'Fakulta filozofická', 'FF UPa', 'other', 'https://ff.upce.cz', 100),
  f('czu', 'czu-ivp', 'Institut vzdělávání a poradenství', 'IVP ČZU', 'other', 'https://www.ivp.czu.cz', 150, 'Učitelství odborných předmětů a praktického vyučování.'),
  f('vscht', 'vscht-ucit', 'Učitelství chemie (VŠCHT)', 'VŠCHT', 'other', 'https://www.vscht.cz', 50),
  f('cvut', 'cvut-muvs', 'Masarykův ústav vyšších studií', 'MÚVS ČVUT', 'other', 'https://www.muvs.cvut.cz', 100),
  f('mendelu', 'mendelu-icv', 'Institut celoživotního vzdělávání', 'ICV MENDELU', 'other', 'https://icv.mendelu.cz', 100),
];

export const STUDENT_PROGRAM_PEDF_COUNT = STUDENT_PROGRAM_FACULTIES.filter((x) => x.kind === 'pedf').length;

/** Doména z e-mailu (lowercase, bez mezer). Prázdný řetězec = neplatný e-mail. */
export function emailDomain(email: string): string {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at <= 0 || at === e.length - 1) return '';
  return e.slice(at + 1);
}

/** Doména sedí na kořen (`cuni.cz`) i libovolnou subdoménu (`student.pedf.cuni.cz`). */
export function domainMatchesRoot(domain: string, root: string): boolean {
  const d = domain.toLowerCase();
  const r = root.toLowerCase();
  return d === r || d.endsWith(`.${r}`);
}

export type UniversityEmailMatch = {
  domain: string;
  universityShort: string;
  university: string;
  ico: string;
  /** Fakulty dané univerzity — pedagogická první. */
  faculties: StudentProgramFaculty[];
};

/**
 * Najde univerzitu podle domény e-mailu. Vrací `null`, když doména není
 * v seznamu (Gmail, Seznam, neznámá škola…). Nedělá DNS ani nic síťového.
 */
export function matchUniversityEmail(
  email: string,
  faculties: StudentProgramFaculty[] = STUDENT_PROGRAM_FACULTIES,
): UniversityEmailMatch | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  const hits = faculties.filter((fac) => fac.emailDomains.some((root) => domainMatchesRoot(domain, root)));
  if (hits.length === 0) return null;
  const first = hits[0];
  const sorted = [...hits].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'pedf' ? -1 : 1;
    return a.facultyShort.localeCompare(b.facultyShort, 'cs');
  });
  return {
    domain,
    universityShort: first.universityShort,
    university: first.university,
    ico: first.ico,
    faculties: sorted,
  };
}

/** Bezpečný label fakulty pro e-maily a admin. */
export function facultyLabel(fac: Pick<StudentProgramFaculty, 'facultyShort' | 'faculty' | 'universityShort'>): string {
  return fac.facultyShort || `${fac.faculty} ${fac.universityShort}`;
}

/** Konec studia „YYYY-MM“ → datum posledního dne měsíce (ISO `YYYY-MM-DD`). */
export function graduationMonthToDate(value: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`;
}

/** Přístup platí ještě půl roku po konci studia. */
export const STUDENT_PROGRAM_GRACE_MONTHS = 6;

export function accessValidUntilFromGraduation(graduationIso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(graduationIso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + STUDENT_PROGRAM_GRACE_MONTHS, Number(m[3])));
  // Když měsíc nemá tolik dní (31. → 30.), JS přeteče; srovnáme na poslední den cílového měsíce.
  const targetMonth = (Number(m[2]) - 1 + STUDENT_PROGRAM_GRACE_MONTHS) % 12;
  if (d.getUTCMonth() !== targetMonth) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
