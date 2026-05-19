import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Building2, Loader2, Search } from 'lucide-react';

export type WebinarRegFormState = {
  name: string;
  email: string;
  phone: string;
  position: string;
  gdpr: boolean;
  newsletter: boolean;
  schoolName: string;
  ico: string;
  /** Z autocomplete školy (pro Pipedrive organizaci) */
  schoolAddress: string;
  webinarMotivation: string;
  webinarTopicInterest: string;
  usesVividbooks: '' | 'yes' | 'no';
  /** Volitelné — brána DVPP dotazníku na stránce webináře */
  birthDateIso?: string;
};

type Props = {
  form: WebinarRegFormState;
  notTeacher: boolean;
  onTogglePedagogMode: () => void;
  handleChange: (field: keyof WebinarRegFormState, value: string | boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleSchoolNameChange: (v: string) => void;
  handleSchoolSelect: (school: { ico: string; name: string; address?: string }) => void;
  handleIcoChange: (v: string) => void;
  schoolContainerRef: React.RefObject<HTMLDivElement | null>;
  schoolResults: { ico: string; name: string; address?: string }[];
  schoolOpen: boolean;
  setSchoolOpen: (v: boolean) => void;
  schoolSearching: boolean;
  error: string;
  submitting: boolean;
  positions: string[];
  submitButtonText?: string;
};

/**
 * Společný blok polí pro POST /webinar-registrace — stránka webináře i celostránkový dotazník po akci.
 */
export function WebinarRegistrationFormFields({
  form,
  notTeacher,
  onTogglePedagogMode,
  handleChange,
  handleSubmit,
  handleSchoolNameChange,
  handleSchoolSelect,
  handleIcoChange,
  schoolContainerRef,
  schoolResults,
  schoolOpen,
  setSchoolOpen,
  schoolSearching,
  error,
  submitting,
  positions,
  submitButtonText = 'P\u0159ihl\u00e1sit',
}: Props) {
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex items-center justify-between bg-white rounded-[12px] px-4 py-3 border border-[#001161]/10">
        <div>
          <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-[#001161] leading-tight">
            {notTeacher ? 'Nejsem pedagog' : 'Jsem pedagog'}
          </p>
          <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 leading-tight mt-0.5">
            {notTeacher
              ? 'Nepot\u0159ebuji certifik\u00e1t DVPP'
              : 'Po webin\u00e1\u0159i obdr\u017e\u00edm certifik\u00e1t DVPP'}
          </p>
        </div>
        <button
          type="button"
          onClick={onTogglePedagogMode}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#001161]/30 ${notTeacher ? 'bg-red-500' : 'bg-emerald-600'}`}
          aria-checked={!notTeacher}
          role="switch"
          aria-label={notTeacher ? 'Zapnout režim pedagog s certifikátem DVPP' : 'Vypnout — nejsem pedagog'}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notTeacher ? 'translate-x-0' : 'translate-x-5'}`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!notTeacher && (
          <motion.div
            key="school-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col gap-3 overflow-visible"
          >
            <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-1 pl-1">
              {'Informace o \u0161kole'}
            </p>

            <div ref={schoolContainerRef} className="relative">
              <input
                type="text"
                value={form.schoolName}
                onChange={(e) => handleSchoolNameChange(e.target.value)}
                onFocus={() => schoolResults.length > 0 && setSchoolOpen(true)}
                placeholder={'\u00a0N\u00e1zev \u0161koly'}
                autoComplete="off"
                className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
              />
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30">
                {schoolSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </div>
              <AnimatePresence>
                {schoolOpen && schoolResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-[100] mt-1 w-full bg-white border border-[#001161]/10 rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div className="max-h-[220px] overflow-y-auto py-1">
                      {schoolResults.map((s, i) => (
                        <button
                          key={`${s.ico}-${i}`}
                          type="button"
                          onClick={() => handleSchoolSelect(s)}
                          className="w-full text-left px-4 py-3 hover:bg-[#F0F2F8] transition-colors flex items-start gap-3 group"
                        >
                          <Building2 className="w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0 group-hover:text-[#5B4FD8] transition-colors" />
                          <div className="flex-1 min-w-0">
                            <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] font-semibold leading-tight truncate">
                              {s.name}
                            </p>
                            {s.address ? (
                              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 mt-0.5">
                                {s.address}
                                {' · I\u010cO: '}
                                {s.ico}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={form.ico}
              onChange={(e) => handleIcoChange(e.target.value)}
              placeholder={'I\u010cO \u0161koly'}
              maxLength={10}
              className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1">
        {'Kontaktn\u00ed \u00fadaje'}
      </p>

      <input
        type="text"
        required
        value={form.name}
        onChange={(e) => handleChange('name', e.target.value)}
        placeholder={'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'}
        className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
      />
      <input
        type="email"
        required
        value={form.email}
        onChange={(e) => handleChange('email', e.target.value)}
        placeholder={'V\u00e1\u0161 e-mail *'}
        className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
      />
      <input
        type="tel"
        value={form.phone}
        onChange={(e) => handleChange('phone', e.target.value)}
        placeholder={'Telefon'}
        className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
      />

      <div className="relative">
        <select
          required
          value={form.position}
          onChange={(e) => handleChange('position', e.target.value)}
          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all appearance-none cursor-pointer"
          style={{ color: form.position ? '#001161' : 'rgba(0,17,97,0.4)' }}
        >
          <option value="" disabled>
            {'Va\u0161e pozice *'}
          </option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/40">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1">
        {'Webin\u00e1\u0159'}
      </p>
      <label className="block">
        <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-1 block">
          {'S jakou motivac\u00ed p\u0159ich\u00e1z\u00edte na tento webin\u00e1\u0159?'}
        </span>
        <textarea
          rows={4}
          value={form.webinarMotivation}
          onChange={(e) => handleChange('webinarMotivation', e.target.value)}
          placeholder={'Kr\u00e1tce popi\u0161te, co v\u00e1s k akci vede\u2026'}
          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all resize-y min-h-[96px]"
        />
      </label>
      <label className="block">
        <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-1 block">
          {'Co by v\u00e1s u t\u00e9matu nejv\u00edce zaj\u00edmalo?'}
        </span>
        <textarea
          rows={4}
          value={form.webinarTopicInterest}
          onChange={(e) => handleChange('webinarTopicInterest', e.target.value)}
          placeholder={'T\u00e9mata, ot\u00e1zky nebo o\u010dek\u00e1v\u00e1n\u00ed\u2026'}
          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all resize-y min-h-[96px]"
        />
      </label>
      <div>
        <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-2 block">
          {'Pou\u017e\u00edv\u00e1m Vividbooks *'}
        </span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]">
            <input
              type="radio"
              name="usesVividbooks"
              required
              checked={form.usesVividbooks === 'yes'}
              onChange={() => handleChange('usesVividbooks', 'yes')}
              className="w-4 h-4 accent-[#5B4FD8]"
            />
            {'Ano'}
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]">
            <input
              type="radio"
              name="usesVividbooks"
              required
              checked={form.usesVividbooks === 'no'}
              onChange={() => handleChange('usesVividbooks', 'no')}
              className="w-4 h-4 accent-[#5B4FD8]"
            />
            {'Ne'}
          </label>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer mt-1">
        <div
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${form.gdpr ? 'bg-[#5B4FD8] border-[#5B4FD8]' : 'bg-white border-[#001161]/20'}`}
          onClick={() => handleChange('gdpr', !form.gdpr)}
        >
          {form.gdpr ? (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </div>
        <span
          className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 leading-snug"
          onClick={() => handleChange('gdpr', !form.gdpr)}
        >
          {'Souhlas\u00edm se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f podle\u00a0'}
          <a
            href="https://www.vividbooks.cz/gdpr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#5B4FD8] hover:opacity-75"
            onClick={(e) => e.stopPropagation()}
          >
            {'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f'}
          </a>
          {'. *'}
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer bg-[#FFF7ED] rounded-xl px-4 py-3 border border-[#E8942A]/20">
        <span className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={form.newsletter}
            onChange={() => handleChange('newsletter', !form.newsletter)}
            className="sr-only peer"
          />
          <span className="block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors" />
          <span className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]" />
        </span>
        <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/80 leading-[1.5]">
          <span className="font-bold text-[#001161]">{'📚 Chci dostávat novinky a tipy do výuky'}</span>
          <br />
          {
            'Novinky, tipy do v\u00fduky a akce \u2014 pos\u00edl\u00e1me je jen tehdy, kdy\u017e stoj\u00ed za p\u0159e\u010dten\u00ed. Bez spamu.'
          }
        </span>
      </label>

      {error ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="font-['Fenomen_Sans',sans-serif] text-red-600 text-[13px]">{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[16px] py-4 rounded-[14px] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,140,0,0.35)]"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            {'Odes\u00edl\u00e1m...'}
          </>
        ) : (
          submitButtonText
        )}
      </button>
      <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 text-center">{'* Povinn\u00e9 pole'}</p>
    </form>
  );
}
