/**
 * Klient studentského programu (web `/studenti` + admin Marketing → Studenti).
 * Server: `src/supabase/functions/server/studentProgram.ts`.
 */
import { projectId, publicAnonKey } from './supabase/info';
import { fetchWithAdminAuth } from '../lib/edgeFunctionHeaders';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
export const STUDENT_PROGRAM_PUBLIC = `${SERVER}/student-program`;
export const STUDENT_PROGRAM_ADMIN = `${SERVER}/admin/student-program`;

export type StudentProgramPublicFaculty = {
  id: string;
  university: string;
  universityShort: string;
  faculty: string;
  facultyShort: string;
  city: string | null;
  kind: 'pedf' | 'other';
  emailDomains: string[];
};

export type StudentProgramStudentView = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  universityEmail: string;
  personalEmail: string | null;
  phone: string | null;
  status: 'pending' | 'active' | 'graduating' | 'alumni' | 'expired' | 'declined' | 'unsubscribed';
  expectedGraduation: string | null;
  accessValidUntil: string | null;
  teacherCode: string | null;
  studentCode: string | null;
  codesValidUntil: string | null;
  faculty: StudentProgramPublicFaculty | null;
  subjects: string[];
  schoolStages: string[];
  studyProgramme: string | null;
  employerStatus: 'unknown' | 'teaching' | 'not_teaching' | 'studying_further';
  employerSchoolName: string | null;
  employerSchoolIco: string | null;
  usesInPractice: boolean | null;
  newsletter: boolean;
  checkinCount: number;
};

export type CheckEmailResult =
  | { ok: true; university: string; universityShort: string; faculties: Array<{ id: string; faculty: string; facultyShort: string; kind: 'pedf' | 'other' }>; existingStatus: string | null }
  | { ok: false; reason: 'invalid' | 'not_university' | 'error'; domain?: string; message?: string };

export type RegisterInput = {
  firstName: string;
  lastName: string;
  universityEmail: string;
  personalEmail: string;
  phone: string;
  facultyId: string;
  studyProgramme: string;
  subjects: string[];
  schoolStages: string[];
  /** `YYYY-MM` */
  expectedGraduation: string;
  consentTerms: boolean;
  newsletter: boolean;
  source?: string;
  utm?: Record<string, string>;
};

export type RegisterResult =
  | { status: 'pending'; resent: boolean; emailSent: boolean; message: string }
  | { status: 'already_active'; message: string }
  | { status: 'contact_us'; message: string };

const anonHeaders = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `Chyba serveru (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

/* ── veřejné ─────────────────────────────────────────────────────────────── */

export async function fetchStudentProgramFaculties(): Promise<StudentProgramPublicFaculty[]> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/faculties`, { headers: anonHeaders });
  const data = await readJson<{ faculties: StudentProgramPublicFaculty[] }>(res);
  return data.faculties || [];
}

export async function checkStudentEmail(email: string): Promise<CheckEmailResult> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/check-email?email=${encodeURIComponent(email)}`, { headers: anonHeaders });
  return readJson<CheckEmailResult>(res);
}

export async function registerStudent(input: RegisterInput): Promise<RegisterResult> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/register`, { method: 'POST', headers: anonHeaders, body: JSON.stringify(input) });
  return readJson<RegisterResult>(res);
}

export async function verifyStudentToken(token: string): Promise<{ valid: boolean; alreadyVerified?: boolean; expired?: boolean; codesPending?: boolean; error?: string; student?: StudentProgramStudentView }> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/verify?t=${encodeURIComponent(token)}`, { headers: anonHeaders });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { valid: false, error: `Chyba serveru (${res.status}).` };
  }
}

export async function fetchStudentSelf(token: string): Promise<StudentProgramStudentView> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/me?t=${encodeURIComponent(token)}`, { headers: anonHeaders });
  const data = await readJson<{ student: StudentProgramStudentView }>(res);
  return data.student;
}

export type SelfUpdateInput = {
  studyStatus: 'studying' | 'graduated' | 'ended';
  expectedGraduation?: string;
  usesInPractice?: boolean | null;
  phone?: string;
  personalEmail?: string;
  employerStatus?: 'teaching' | 'not_teaching' | 'studying_further' | '';
  employerSchoolName?: string;
  employerSchoolIco?: string;
  feedback?: string;
  newsletter?: boolean;
};

export async function updateStudentSelf(token: string, input: SelfUpdateInput): Promise<StudentProgramStudentView> {
  const res = await fetch(`${STUDENT_PROGRAM_PUBLIC}/update?t=${encodeURIComponent(token)}`, { method: 'POST', headers: anonHeaders, body: JSON.stringify(input) });
  const data = await readJson<{ ok: boolean; student: StudentProgramStudentView }>(res);
  return data.student;
}

/** Rejstřík škol (stejný endpoint jako trial formulář). */
export async function searchSchoolsRegistry(q: string): Promise<Array<{ ico: string; name: string; address: string; kraj: string }>> {
  const res = await fetch(`${SERVER}/school-search?q=${encodeURIComponent(q)}`, { headers: anonHeaders });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

/* ── admin ───────────────────────────────────────────────────────────────── */

export type StudentProgramGoals = {
  targetStudents: number;
  targetDate: string;
  targetPedfCoverage: number;
  targetFacultyPartners: number;
  targetActiveShare: number;
  targetAlumniSchoolKnown: number;
  note?: string;
};

export type StudentProgramSettings = {
  autoIssueCodes: boolean;
  legacyVatMode: 'none' | 'university_ico';
  legacyTrialDays: number;
  checkinIntervalDays: number;
  digestEmail: string;
  outreachFromName: string;
  outreachReplyTo: string;
  extensionWarnDays: number;
};

export type StudentProgramOverview = {
  generatedAt: string;
  goals: StudentProgramGoals;
  totals: { registered: number; pending: number; verified: number; active: number; byStatus: Record<string, number>; verificationRate: number | null; withPhone: number; withPersonalEmail: number; newsletter: number };
  coverage: { pedfTotal: number; pedfCovered: number; otherTotal: number; otherCovered: number; partners: number; contacted: number; estimatedPool: number; poolShare: number | null };
  engagement: { responded: number; usesYes: number; activeShare: number | null; checkinsSent: number; responseRate: number | null };
  alumni: { total: number; schoolKnown: number; schoolShare: number | null; teaching: number };
  progress: { studentsPct: number | null; pedfPct: number | null; partnersPct: number | null; activeSharePct: number | null; alumniSchoolPct: number | null; daysToTarget: number };
  queues: { studentsNeedingExtension: Array<{ id: string; name: string; email: string; facultyShort: string | null; codesValidUntil: string | null; accessValidUntil: string | null }>; extensionDue: number; studentsWithoutCodes: number; graduatingSoon: number; checkinsDue: number; pendingOlderThan3Days: number; importedNotInvited: number };
  months: Record<string, { registered: number; verified: number }>;
  perFaculty: Array<{ id: string; facultyShort: string; university: string; kind: 'pedf' | 'other'; outreachStatus: string; estimatedStudents: number | null; total: number; active: number; alumni: number; responded: number; usesYes: number }>;
};

export type StudentProgramStudentRow = {
  id: string;
  university_email: string;
  personal_email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  faculty_id: string | null;
  study_programme: string | null;
  subjects: string[];
  school_stages: string[];
  expected_graduation: string | null;
  status: StudentProgramStudentView['status'];
  verified_at: string | null;
  verification_sent_at: string | null;
  teacher_code: string | null;
  student_code: string | null;
  codes_issued_at: string | null;
  codes_valid_until: string | null;
  legacy_result: string | null;
  legacy_reason: string | null;
  access_valid_until: string | null;
  access_extended_until: string | null;
  next_checkin_at: string | null;
  last_checkin_sent_at: string | null;
  checkin_count: number;
  last_response_at: string | null;
  engagement: 'unknown' | 'active' | 'passive' | 'inactive';
  uses_in_practice: boolean | null;
  last_self_report: Record<string, unknown>;
  employer_status: 'unknown' | 'teaching' | 'not_teaching' | 'studying_further';
  employer_school_name: string | null;
  employer_school_ico: string | null;
  consent_terms: boolean;
  newsletter: boolean;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentProgramFacultyContact = {
  id: string;
  faculty_id: string;
  name: string;
  role: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: 'new' | 'contacted' | 'replied' | 'partner' | 'declined';
  last_contacted_at: string | null;
  last_reply_at: string | null;
  notes: string | null;
};

export type StudentProgramFacultyRow = {
  id: string;
  university: string;
  university_short: string;
  faculty: string;
  faculty_short: string;
  city: string | null;
  region: string | null;
  ico: string | null;
  email_domains: string[];
  kind: 'pedf' | 'other';
  website: string | null;
  estimated_students: number | null;
  is_active: boolean;
  outreach_status: 'not_contacted' | 'contacted' | 'in_talks' | 'partner' | 'declined';
  outreach_owner: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  samples_sent_at: string | null;
  workshop_at: string | null;
  notes: string | null;
  stats: { total: number; active: number; alumni: number; usesYes: number; responded: number };
  contacts: StudentProgramFacultyContact[];
};

export type OutreachTemplate = { key: 'intro_dean' | 'intro_department' | 'followup' | 'students_broadcast'; label: string; hint: string };

export type StudentProgramEvent = { id: number; student_id: string | null; faculty_id: string | null; type: string; payload: Record<string, unknown>; actor: string; created_at: string };

async function adminJson<T>(path: string, init?: RequestInit & { json?: boolean }): Promise<T> {
  const res = await fetchWithAdminAuth(`${STUDENT_PROGRAM_ADMIN}${path}`, init);
  return readJson<T>(res);
}

export const studentProgramAdmin = {
  overview: () => adminJson<{ overview: StudentProgramOverview; settings: StudentProgramSettings }>('/overview'),
  students: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return adminJson<{ items: StudentProgramStudentRow[]; total: number; limit: number; offset: number }>(`/students?${qs.toString()}`);
  },
  studentEvents: (id: string) => adminJson<{ items: StudentProgramEvent[] }>(`/students/${id}/events`),
  updateStudent: (id: string, patch: Partial<StudentProgramStudentRow>) =>
    adminJson<{ ok: boolean; item: StudentProgramStudentRow }>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(patch), json: true }),
  resendCodes: (id: string) => adminJson<{ ok: boolean; detail: string | null; hasCodes: boolean }>(`/students/${id}/resend-codes`, { method: 'POST' }),
  invite: (id: string) => adminJson<{ ok: boolean; detail: string | null }>(`/students/${id}/invite`, { method: 'POST' }),
  issueCodes: (id: string, force = false) => adminJson<{ ok: boolean; legacyResult: string; legacyReason: string | null; item: StudentProgramStudentRow }>(`/students/${id}/issue-codes${force ? '?force=1' : ''}`, { method: 'POST' }),
  sendCheckin: (id: string) => adminJson<{ ok: boolean; detail: string | null }>(`/students/${id}/send-checkin`, { method: 'POST' }),
  deleteStudent: (id: string) => adminJson<{ ok: boolean }>(`/students/${id}`, { method: 'DELETE' }),
  faculties: () => adminJson<{ items: StudentProgramFacultyRow[]; unassigned: { total: number; active: number } | null; templates: OutreachTemplate[] }>('/faculties'),
  seedFaculties: () => adminJson<{ ok: boolean; inserted: number }>('/faculties/seed', { method: 'POST' }),
  updateFaculty: (id: string, patch: Partial<StudentProgramFacultyRow>) =>
    adminJson<{ ok: boolean; item: StudentProgramFacultyRow }>(`/faculties/${id}`, { method: 'PUT', body: JSON.stringify(patch), json: true }),
  facultyEvents: (id: string) => adminJson<{ items: StudentProgramEvent[] }>(`/faculties/${id}/events`),
  addContact: (facultyId: string, input: Partial<StudentProgramFacultyContact>) =>
    adminJson<{ ok: boolean; item: StudentProgramFacultyContact }>(`/faculties/${facultyId}/contacts`, { method: 'POST', body: JSON.stringify(input), json: true }),
  updateContact: (id: string, patch: Partial<StudentProgramFacultyContact>) =>
    adminJson<{ ok: boolean; item: StudentProgramFacultyContact }>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(patch), json: true }),
  deleteContact: (id: string) => adminJson<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),
  outreachDraft: (input: { facultyId: string; template: OutreachTemplate['key']; contactName?: string; department?: string }) =>
    adminJson<{ ok: boolean; subject: string; text: string; link: string }>('/outreach/draft', { method: 'POST', body: JSON.stringify(input), json: true }),
  outreachSend: (input: { facultyId: string; contactId?: string; toEmail: string; toName?: string; subject: string; text: string }) =>
    adminJson<{ ok: boolean; detail: string | null }>('/outreach/send', { method: 'POST', body: JSON.stringify(input), json: true }),
  goals: () => adminJson<{ goals: StudentProgramGoals; settings: StudentProgramSettings; defaults: { goals: StudentProgramGoals; settings: StudentProgramSettings } }>('/goals'),
  saveGoals: (input: { goals?: Partial<StudentProgramGoals>; settings?: Partial<StudentProgramSettings> }) =>
    adminJson<{ ok: boolean; goals: StudentProgramGoals; settings: StudentProgramSettings }>('/goals', { method: 'PUT', body: JSON.stringify(input), json: true }),
  runCron: (dryRun: boolean) => adminJson<{ ok: boolean; checkins: number; graduating: number; expired: number; errors: string[]; digestSent: boolean; dryRun: boolean }>(`/run-cron${dryRun ? '?dryRun=1' : ''}`, { method: 'POST' }),
  exportCsvUrl: () => `${STUDENT_PROGRAM_ADMIN}/export.csv`,
  exportCsv: async () => {
    const res = await fetchWithAdminAuth(`${STUDENT_PROGRAM_ADMIN}/export.csv`);
    if (!res.ok) throw new Error(`Export selhal (${res.status}).`);
    return res.blob();
  },
};

/* ── labely sdílené webem i adminem ─────────────────────────────────────────── */

export const STUDENT_STATUS_LABELS: Record<StudentProgramStudentView['status'], string> = {
  pending: 'Čeká na ověření',
  active: 'Aktivní',
  graduating: 'Končí studium',
  alumni: 'Absolvent',
  expired: 'Přístup skončil',
  declined: 'Ukončil/a',
  unsubscribed: 'Odhlášen/a',
};

export const FACULTY_OUTREACH_LABELS: Record<StudentProgramFacultyRow['outreach_status'], string> = {
  not_contacted: 'Neosloveno',
  contacted: 'Osloveno',
  in_talks: 'V jednání',
  partner: 'Partner',
  declined: 'Odmítli',
};

export const CONTACT_STATUS_LABELS: Record<StudentProgramFacultyContact['status'], string> = {
  new: 'Nový',
  contacted: 'Osloven',
  replied: 'Odpověděl',
  partner: 'Partner',
  declined: 'Odmítl',
};

export function formatCzDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return withTime
    ? d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}
