import{f as wt,r as n,p as je,b as fe,j as e,L as jt,m as U,t as Ie,_ as kt,A as ke,n as Nt,e as St,h as Ct,l as dt,w as zt,i as Be,k as Ft,N as Dt}from"./index-bphrrGxx.js";import{a as $t,W as Pt}from"./WebinarCard-CeBmwoQd.js";import{S as Le,w as Te}from"./SEOHead-Pp9-zDAF.js";import{m as Oe}from"./marketingSite-B0_f04yi.js";import{T as Et,S as _t,s as Rt}from"./TrialPage-BGkZzb-t.js";import{i as Qe,a as Je}from"./emailValidation-zWHvJ6yV.js";import{C as pt}from"./circle-check-big-DM7zhekU.js";import{E as At}from"./external-link-D_NDVEWy.js";import{C as It}from"./clock-ByftQWKf.js";import{L as ce}from"./loader-circle-CIt_7cVo.js";import{C as mt}from"./circle-alert-DiXOmm_3.js";import{g as xt,a as ut,w as Bt,b as Lt,c as Tt}from"./webinarSurveyDefaults-4Jc6LAJj.js";import{l as Ot}from"./svg-fupfguvmdt-BJftoE9y.js";import{A as Vt}from"./award-D1xeYemU.js";import{D as Mt}from"./download-8BZ16WP2.js";import{C as Fe}from"./chevron-left-aNf3-fju.js";import{C as Ae}from"./chevron-right-mnaDNmUQ.js";import{C as Ut}from"./clipboard-list-CbeI_CVl.js";import{C as Wt}from"./check-buHDpjTo.js";import{S as ft}from"./search-LRIe104y.js";import{B as ht}from"./building-2-B1CqdLez.js";import{l as Ve,r as Gt}from"./dvppSavedContacts-B9FJeLoK.js";import{C as Ht}from"./calendar-BTfNUpZV.js";import"./ImageWithFallback-r1OoOJl2.js";import"./play-DpRsMecL.js";import"./user-BRynw4yn.js";import"./message-circle-Bct11oJB.js";import"./mail-DlYFpkDu.js";import"./phone-BnpOuUGS.js";import"./users-CXXo7NJx.js";import"./sparkles-mIBirj7A.js";import"./book-open-sXIwXoGz.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qt=[["path",{d:"M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21",key:"9csbqa"}],["path",{d:"m14 19 3 3v-5.5",key:"9ldu5r"}],["path",{d:"m17 22 3-3",key:"1nkfve"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}]],Ze=wt("image-down",Qt),Me=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,Q={fontFamily:"'Fenomen Sans', sans-serif"};function Jt(t){return/Učitel|Pedagogický/i.test(t)}function Zt(t){return{name:t.name.trim(),email:t.email.trim(),phone:t.phone.trim(),position:t.position,schoolName:t.schoolName.trim(),vat:t.ico.replace(/\D/g,"").slice(0,10),gdpr:t.gdpr,newsletter:t.newsletter,teacherSubjects:Jt(t.position)?["Other-2"]:[],schoolStages:[]}}function Yt({form:t,notTeacher:s}){const[o,x]=n.useState(null),[l,j]=n.useState(""),[E,D]=n.useState(!1),[L,k]=n.useState([]),[N,c]=n.useState(null),[C,y]=n.useState([]),[F,d]=n.useState(!1),[f,p]=n.useState(null),[u,i]=n.useState(null),[I,m]=n.useState(!1),[b,J]=n.useState(null),[W,Z]=n.useState(!1),[G,T]=n.useState(""),S=t.ico.replace(/\D/g,"").slice(0,10),z=(o==="active_subscription"||o==="active_trial"||o==="in_progress")&&!!l&&!E,g=F&&!E&&!z&&o!=="unknown"&&o!=="invalid"&&o!==null&&S.length>=6,v=n.useMemo(()=>{if(!f)return null;const $=new Date(f);return Number.isNaN($.getTime())?null:{dateStr:$.toLocaleDateString("cs-CZ",{day:"numeric",month:"long",year:"numeric"}),daysLeft:Math.max(0,Math.ceil(($.getTime()-Date.now())/(1e3*60*60*24)))}},[f]),_=n.useRef(null);n.useEffect(()=>{if(s||S.length<6){x(null),j(""),k([]),c(null),y([]),d(!1),p(null);return}_.current&&clearTimeout(_.current),_.current=setTimeout(async()=>{D(!0);try{const A=await(await fetch(`${Me}/school-pipedrive-check?ico=${encodeURIComponent(S)}`,{headers:{Authorization:`Bearer ${fe}`}})).json();x(A.status||"unknown"),j(typeof A.message=="string"?A.message:""),k(Array.isArray(A.colleagues)?A.colleagues:[]),c(A.owner??null),y(Array.isArray(A.products)?A.products:[]),d(!!A.trialCooldownActive),p(typeof A.trialNextEligibleAt=="string"?A.trialNextEligibleAt:null)}catch{x("unknown"),j(""),k([]),c(null),y([]),d(!1),p(null)}finally{D(!1)}},600)},[S,s]);const R=n.useRef(null);n.useEffect(()=>{const $=t.email.trim();if(s||!$||!Qe($)){i(null);return}R.current&&clearTimeout(R.current),R.current=setTimeout(async()=>{m(!0);try{const A=await fetch(`${Me}/check-trial-email?email=${encodeURIComponent($)}`,{headers:{Authorization:`Bearer ${fe}`}});i(await A.json())}catch{i(null)}finally{m(!1)}},400)},[t.email,s]);const h=async()=>{if(!(z||g)){if(!t.gdpr){T("Chybí souhlas se zpracováním údajů z registrace.");return}if(u?.emailInvalid&&u.message){T(u.message);return}if(u&&!u.canRequest&&!u.emailInvalid){T(`S tímto e-mailem byl trial již požádán. Další žádost můžete podat od ${u.cooldownDateStr}.`);return}if(!Qe(t.email.trim())){T(Je);return}Z(!0),T("");try{const A=await(await fetch(`${Me}/validate-email?email=${encodeURIComponent(t.email.trim())}`,{headers:{Authorization:`Bearer ${fe}`}})).json();if(!A.ok){T(typeof A.message=="string"?A.message:Je);return}const H=Zt(t),q=await Rt(H);if(q.status==="error"){T(q.message);return}J(q)}catch($){T($ instanceof Error?$.message:"Odeslání se nezdařilo.")}finally{Z(!1)}}};return s?e.jsxs("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:[e.jsx("p",{style:Q,className:"text-[14px] font-bold text-[#001161] mb-2",children:"Zkusit Vividbooks zdarma"}),e.jsx("p",{style:Q,className:"text-[13px] text-[#001161]/65 leading-relaxed mb-4",children:"Pro 14denní přístup potřebujeme název školy a IČO. Vyplněte prosím zkušební formulář."}),e.jsx(jt,{to:"/vyzkousejte",className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 font-bold text-[14px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline",style:Q,children:"Přejít na zkušební přístup"})]}):b?.status==="codes"?e.jsx(U.div,{initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:e.jsxs("div",{className:"rounded-[20px] border border-green-200 bg-[#F0FDF4] p-6",children:[e.jsx(pt,{className:"mx-auto mb-3 h-10 w-10 text-green-500"}),e.jsx("h3",{className:"mb-2 text-center font-['Cooper_Light',serif] text-[22px] text-[#001161]",children:"Zkušební přístup"}),e.jsx("p",{style:Q,className:"mb-5 text-center text-[13px] text-[#001161]/70 leading-snug",children:b.kind==="existing_trial"?"Vaše škola už má aktivní zkušební přístup. Pro přihlášení použijte tyto kódy:":"Vaše přístupové kódy pro zkušební verzi:"}),e.jsxs("div",{className:"mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{className:"rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm",children:[e.jsx("p",{style:Q,className:"mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45",children:"Kód pro učitele"}),e.jsx("p",{style:Q,className:"font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all",children:b.teacherCode})]}),e.jsxs("div",{className:"rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm",children:[e.jsx("p",{style:Q,className:"mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45",children:"Kód pro žáka"}),e.jsx("p",{style:Q,className:"font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all",children:b.studentCode})]})]}),e.jsxs("a",{href:"https://app.vividbooks.com",target:"_blank",rel:"noopener noreferrer",className:"mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline",style:Q,children:[e.jsx(At,{className:"h-4 w-4 shrink-0","aria-hidden":!0}),"Otevřít aplikaci"]}),e.jsx(Et,{compact:!0,sectionClassName:"mt-5 border-t border-green-200/70 pt-5"})]})}):b?.status==="thank_only"?e.jsx("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:e.jsx("p",{style:Q,className:"text-[14px] text-[#001161]/75 leading-relaxed",children:"Děkujeme za žádost. Ozveme se vám co nejdříve s přístupovými údaji na e-mail."})}):e.jsxs("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{style:Q,className:"text-[16px] font-bold text-[#001161] mb-1",children:"Vyzkoušejte Vividbooks"}),e.jsx("p",{style:Q,className:"text-[13px] text-[#001161]/60 leading-relaxed",children:z?"Máte přístup do Vividbooks? Ve vaší škole už digitální učebnice využívají kolegové. Kontakt a případné kódy najdete níže.":g?"Vaše škola nedávno žádala o zkušební přístup. Možnosti máte níže.":"Máte zájem o 14denní přístup k digitálním učebnicím? Stačí jeden klik — stejně jako u zkušebního formuláře vám přijde potvrzení a přístupové kódy."})]}),e.jsx(_t,{readOnly:!0,schoolName:t.schoolName,ico:S,onSelect:()=>{},onIcoChange:()=>{},pdStatus:o,pdMessage:l,pdLoading:E,colleagues:L,owner:N,products:C,hidePipedriveStatusCard:g}),g&&e.jsxs(U.div,{initial:{opacity:0,y:-4},animate:{opacity:1,y:0},className:"overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/90",children:[e.jsxs("div",{className:"flex items-center gap-2.5 px-4 pt-4 pb-2",children:[e.jsx(It,{className:"h-4 w-4 shrink-0 text-amber-600","aria-hidden":!0}),e.jsx("p",{style:Q,className:"text-[14px] font-bold text-amber-900",children:"Tato škola dostala přístup nedávno"})]}),e.jsx("div",{className:"space-y-3 px-4 pb-4",children:e.jsxs("div",{className:"space-y-2.5 rounded-xl border border-amber-200/80 bg-white/70 px-3.5 py-3",children:[e.jsx("p",{style:Q,className:"m-0 text-[13px] text-[#001161]/80 leading-relaxed",children:"Zkušební přístupy vydáváme každé škole jednou za šest měsíců."}),v&&e.jsxs("p",{style:Q,className:"m-0 text-[12px] text-amber-900",children:["Další žádost z formuláře bude možná od ",e.jsx("span",{className:"font-bold",children:v.dateStr}),v.daysLeft>0?e.jsxs(e.Fragment,{children:[" (","za ",e.jsx("span",{className:"font-semibold text-[#001161]",children:v.daysLeft})," dní)."]}):"."]}),e.jsxs("p",{style:Q,className:"m-0 text-[12px] text-[#001161]/70",children:["Potřebujete dřív? Napište na ",e.jsx("a",{href:"mailto:hello@vividbooks.com",className:"font-bold text-amber-900 underline underline-offset-2",children:"hello@vividbooks.com"}),N?.name?` (${N.name})`:"","."]})]})})]}),!z&&!g&&e.jsxs("div",{className:"space-y-2",children:[e.jsx("button",{type:"button",onClick:h,disabled:W||!t.gdpr||!!u&&!u.canRequest,className:"flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50",style:Q,children:W?e.jsxs(e.Fragment,{children:[e.jsx(ce,{className:"h-4 w-4 animate-spin"}),"Odesílám…"]}):"Chci přístup"}),e.jsxs("div",{className:"flex items-center justify-center gap-2 min-h-[20px]",children:[I&&e.jsx(ce,{className:"h-3.5 w-3.5 animate-spin text-[#001161]/35"}),u?.emailInvalid&&u.message&&e.jsx("p",{style:Q,className:"text-[12px] text-red-700 text-center",children:u.message}),u&&!u.canRequest&&!u.emailInvalid&&e.jsxs("p",{style:Q,className:"text-[12px] text-amber-800 text-center",children:["S tímto e-mailem byl trial již požádán. Další od ",u.cooldownDateStr,"."]})]})]}),G&&e.jsxs("div",{className:"flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3",children:[e.jsx(mt,{className:"mt-0.5 h-4 w-4 shrink-0 text-red-500"}),e.jsx("p",{style:Q,className:"text-[13px] text-red-700",children:G})]}),e.jsx("p",{style:Q,className:"text-[11px] text-[#001161]/40",children:"Souhlas se zpracováním údajů z registrace na webinář se vztahuje i na tuto žádost o zkušební přístup."})]})}const Kt=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,oe={fontFamily:"'Fenomen Sans', sans-serif"},Ye={fontFamily:"'Cooper Light', serif"},Xt=4,qt=`
    @font-face {
      font-family: 'Fenomen Sans';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Fenomen Sans';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Semi%20Bold.otf') format('opentype');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Cooper Light';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf') format('opentype');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
`,ze={representativeName:"MgA. Vít Škop",representativeTitle:"statutární zástupce vzdělávacího zařízení",companyName:"Vividbooks s.r.o.",addressLine1:"Nad Královskou oborou 33",addressLine2:"Praha 7, 170 00"};function M(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Ke(t){const s=(t||"").trim();return/^https:\/\//i.test(s)?s:""}const es={1:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="160" cy="40" r="60" fill="white" opacity="0.15"/><circle cx="120" cy="160" r="50" fill="white" opacity="0.12"/><ellipse cx="130" cy="100" rx="38" ry="38" fill="#F472B6" opacity="0.9"/><ellipse cx="130" cy="72" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="130" cy="128" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="102" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="158" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><circle cx="130" cy="100" r="25" fill="#EC4899" opacity="0.95"/><circle cx="175" cy="165" r="55" fill="white" opacity="0.15"/><circle cx="30" cy="30" r="30" fill="white" opacity="0.08"/></svg>',2:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="70" y="30" width="110" height="32" rx="4" fill="#9B59B6"/><rect x="70" y="68" width="110" height="32" rx="4" fill="#E74C3C"/><rect x="70" y="106" width="110" height="32" rx="4" fill="#E8E8E8"/><rect x="70" y="144" width="110" height="32" rx="4" fill="#2ECC71"/><circle cx="30" cy="50" r="20" fill="white" opacity="0.1"/><circle cx="20" cy="140" r="30" fill="white" opacity="0.08"/></svg>',3:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="145" cy="100" r="60" fill="#2ECC71" opacity="0.95"/><path d="M85 100 A60 60 0 0 1 145 40 L145 100 Z" fill="#27AE60" opacity="0.9"/><rect x="105" y="60" width="50" height="50" rx="4" fill="#E74C3C" opacity="0.9"/><rect x="120" y="115" width="35" height="35" rx="4" fill="white" opacity="0.9"/><circle cx="90" cy="150" r="20" fill="#3498DB" opacity="0.9"/><circle cx="165" cy="55" r="10" fill="#3498DB" opacity="0.85"/></svg>'},ts="0 0 1786.62 869.93",ss=["p299c6b00","p3cc4870","p98d9300","pf524b00","p26e2d80","p15998cf0","p1bd3b900","p19a24c00","p34d64300","p396dedf0"];function ns(){const t=ss.map(s=>{const o=Ot[s];return`<path d="${M(o)}" fill="#001161"/>`}).join("");return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ts}" fill="none" class="cert-logo-svg" aria-label="Vividbooks" role="img">${t}</svg>`}function as(t){return String(t).padStart(2,"0")}function os(t){return`dne ${t.day}. ${as(t.monthNum)}. ${t.year} od ${(t.time||"—").replace(":",".")}`}function rs(t){const s=t/60,o=Number.isInteger(s)?String(s):String(Math.round(s*10)/10).replace(".",",");return s===1?`${o} hodina`:s>1&&s<5?`${o} hodiny`:`${o} hodin`}function Xe(t){const s=t.trim().split("-");if(s.length!==3)return"";const o=parseInt(s[0],10),x=parseInt(s[1],10),l=parseInt(s[2],10);return!o||!x||!l?"":`${l}. ${x}. ${o}`}function is(t){return new Intl.DateTimeFormat("cs-CZ",{day:"numeric",month:"long",year:"numeric"}).format(t)}function qe(t){const{webinar:s,email:o,participantName:x,birthDateIso:l,kind:j,previewMode:E=!1}=t,D=E?"auto":"186mm",L=E?"10px":"0",k=ns(),N=M(s.title),c=M(s.lecturer||""),C=M(`${s.day}. ${s.monthName} ${s.year}, ${s.time}`),y=typeof s.durationMinutes=="number"?s.durationMinutes:120,F=rs(y),d=M(x.trim()||o.trim()||"účastník"),f=M(o.trim()),p=l&&Xe(l)?M(Xe(l)):"",u=M(is(new Date)),i=M(os(s)),I=j==="dvpp"?"Potvrzení o splnění ověření znalostí z webináře (DVPP)":"Potvrzení o vyplnění dotazníku po webináři",m=j==="dvpp"?"Tímto se potvrzuje, že níže uvedený účastník úspěšně absolvoval ověření znalostí z webináře v rozsahu vzdělávací akce zařazené do systému DVPP. Ověření bylo provedeno vyplněním dotazníku po skončení akce.":"Tímto se potvrzuje vyplnění zpětné vazby po webináři níže uvedeným účastníkem. Doklad slouží pro vaši evidenci; nenahrazuje oficiální certifikát z akreditované dráhy, pokud ho škola vyžaduje samostatně.",b=j==="dvpp"?"Toto potvrzení slouží jako doklad o splnění povinnosti ověření znalostí v rámci účasti na akci (dle pravidel vaší školy a platné legislativy). V případě dotazů kontaktujte organizátora na podpoře Vividbooks.":"Tento doklad potvrzuje účast na zpětné vazbě. Pro oficiální certifikát DVPP použijte odkaz u webináře nebo pokyny od organizátora.",J=M(ze.representativeName),W=M(ze.representativeTitle),Z=M(ze.companyName),G=M(ze.addressLine1),T=M(ze.addressLine2),S=`
    <div class="footer-wrap footer-dvpp-full">
      <div class="footer-grid">
        <div class="footer-col">
          <p class="footer-h">Osvědčení o účasti</p>
          <p class="footer-sub">V online vzdělávacím programu:</p>
          <p class="footer-strong">${N}</p>
          <p class="footer-meta">${i}</p>
        </div>
        <div class="footer-col footer-col-wide">
          <p class="footer-p">
            Program proběhl distanční formou, v rozsahu <strong>${M(F)}</strong>.
            Lektorem webináře byl <strong>${c||"—"}</strong>.
            Program byl zakončen dotazníkovým šetřením.
          </p>
        </div>
        <div class="footer-col">
          <p class="footer-p">${J}</p>
          <p class="footer-p">V Praze dne ${u}</p>
          <p class="footer-small">${W}</p>
        </div>
        <div class="footer-col">
          <p class="footer-strong">${Z}</p>
          <p class="footer-p">${G}</p>
          <p class="footer-p">${T}</p>
        </div>
      </div>
    </div>
  `,z=`
    <div class="footer-wrap footer-simple">
      <p class="footer-p"><strong>${Z}</strong>, ${G}, ${T}</p>
      <p class="footer-small">Vydáno elektronicky: ${u} — ${J}, ${W}</p>
    </div>
  `,g=p&&j==="dvpp"?`<div class="birth">Datum narození: <strong>${p}</strong></div>`:"",v=p||"—",_=`sheet${E?" sheet-preview":""}${j==="dvpp"?" sheet-dvpp":" sheet-feedback"}`,R=Ke(s.coverImage),h=Ke(s.lecturerAvatar),$=(s.monthName||"").trim().slice(0,3).toLowerCase(),A=M(`${s.day}. ${$}. ${s.year} od ${(s.time||"—").replace(":",".")}`),H=M((s.subtitle||"").trim()),q=s.thumbnailVariant===2||s.thumbnailVariant===3?s.thumbnailVariant:1,te=R?`<img class="cert-wt-cover" src="${M(R)}" alt="" />`:es[q],K=h?`<img class="cert-wt-avatar" src="${M(h)}" alt="" />`:"",re=H?`<p class="cert-wt-sub">${H}</p>`:"",O=c?`<p class="cert-wt-lecturer">${c}</p>`:"",le=M((s.monthName||"").trim()),me=M((s.time||"—").replace(":",".")),de=c?`Lektoři: ${c}`:"",he=s.relatedSubjects?.[0]||s.tags?.[0],Y=he?M(String(he)):"",ne=de||Y?`<div class="cert-wc-pills">${de?`<span class="cert-wc-pill">${de}</span>`:""}${Y?`<span class="cert-wc-pill">${Y}</span>`:""}</div>`:"",ae=R?`<div class="cert-webinar-thumb cert-webinar-thumb-coveronly"><img class="cert-wt-cover-full" src="${M(R)}" alt="" /></div>`:`<div class="cert-webinar-thumb">
        <div class="cert-wt-yellow">
          <div class="cert-wt-yellow-top">
            ${re}
            <p class="cert-wt-title">${N}</p>
          </div>
          <div class="cert-wt-yellow-bot">
            <p class="cert-wt-meta">DVPP Webinář zdarma</p>
            <p class="cert-wt-meta">${A}</p>
            ${O}
            ${K}
          </div>
        </div>
        <div class="cert-wt-right">${te}</div>
      </div>`,ye=`
  <div class="cert-inner cert-dvpp-frame">
    <div class="cert-dvpp-split">
      <div class="cert-content-col">
        <div class="cert-content-head">
          <div class="cert-logo-img-wrap">
            ${k}
          </div>
          <p class="cert-kicker">Vzdělávání učitelů</p>
          <h1 class="cert-main-title">Certifikát DVPP</h1>
          <p class="cert-subtitle">Ověření znalostí</p>
        </div>
        <div class="cert-participant-wrap">
          <div class="cert-participant">
            <p class="cert-participant-label">Účastník</p>
            <p class="cert-name">${d}</p>
            <p class="cert-dob">Datum narození: <strong>${v}</strong></p>
          </div>
        </div>
      </div>
      <div class="cert-wc-column" aria-hidden="true">
        <div class="cert-wc-card">
          <div class="cert-wc-thumb-wrap">
            ${ae}
          </div>
          <div class="cert-wc-bar">
            <div class="cert-wc-date">
              <span class="cert-wc-day">${s.day}</span>
              <span class="cert-wc-mon">${le}</span>
              <span class="cert-wc-time">${me}</span>
            </div>
            <div class="cert-wc-bar-main">
              <p class="cert-wc-bar-title">${N}</p>
              ${ne}
            </div>
          </div>
        </div>
      </div>
    </div>
    ${S}
  </div>`,ge=`
    <div class="brand">Vividbooks — vzdělávání učitelů</div>
    <h1>${I}</h1>
    <div class="meta">
      <strong>Webinář:</strong> ${N}<br/>
      <strong>Datum konání:</strong> ${C}<br/>
      <strong>Lektor:</strong> ${c||"—"}<br/>
      <strong>Odhadovaný rozsah akce:</strong> ${y} min (${M(F)})
    </div>
    <p class="text">${m}</p>
    <div class="participant">
      <div class="label">Účastník</div>
      <div class="name">${d}</div>
      <div class="em">${f}</div>
      ${g}
    </div>
    <p class="text body-note">${b}</p>
    ${z}`;return`<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="only light" />
  <title>${j==="dvpp"?"Certifikát DVPP":I}</title>
  <link rel="preconnect" href="https://iekkundgizzdbmkzatdl.supabase.co" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf" as="font" type="font/otf" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf" as="font" type="font/otf" crossorigin />
  <style>
    ${qt}
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    html {
      height: 100%;
      background-color: #ffffff;
      color-scheme: only light;
    }
    body {
      margin: 0;
      padding: ${L};
      min-height: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    strong { font-weight: 600; }
    .sheet {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: ${D};
    }
    .sheet-feedback {
      border: 3px solid #001161;
      border-radius: 12px;
      padding: 22px 28px 18px;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 36%);
      display: flex;
      flex-direction: column;
    }
    .sheet-dvpp {
      border: 3px solid #001161;
      border-radius: 14px;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      background: #fff;
    }
    .sheet-dvpp .cert-inner.cert-dvpp-frame {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
    }
    .sheet-dvpp .cert-dvpp-split {
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 0;
      width: 100%;
      align-items: stretch;
      gap: 0;
    }
    .sheet-dvpp .cert-wc-column {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: stretch;
      align-self: stretch;
      height: 100%;
      min-height: 0;
      min-width: 0;
      padding: 10px 12px 10px 6px;
      background: #f0f2f8;
    }
    .sheet-dvpp .cert-wc-card {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      background: #f0f2f8;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 17, 88, 0.08);
    }
    /* Jako WebinarThumbnail: poměr 16∶9 */
    .sheet-dvpp .cert-wc-thumb-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      flex: 0 0 auto;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-webinar-thumb {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-webinar-thumb-coveronly {
      position: absolute;
      inset: 0;
    }
    .sheet-dvpp .cert-wt-cover-full {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .sheet-dvpp .cert-wt-yellow {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 58%;
      z-index: 2;
      box-sizing: border-box;
      background: #f5d645;
      border-radius: 0 20px 20px 0;
      padding: 14px 12px 14px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wt-yellow-top { flex-shrink: 0; }
    .sheet-dvpp .cert-wt-yellow-bot { flex-shrink: 0; }
    .sheet-dvpp .cert-wt-sub {
      margin: 0 0 6px;
      font-size: 11px;
      line-height: 1.25;
      color: #001158;
      opacity: 0.75;
      font-weight: 500;
    }
    .sheet-dvpp .cert-wt-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.12;
      color: #001158;
      letter-spacing: -0.02em;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
    }
    .sheet-dvpp .cert-wt-meta {
      margin: 0 0 4px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.35;
      color: #001158;
    }
    .sheet-dvpp .cert-wt-lecturer {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.3;
      color: #001158;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-dvpp .cert-wt-avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      object-fit: cover;
      border: 2px solid rgba(0, 17, 88, 0.22);
      display: block;
    }
    .sheet-dvpp .cert-wt-right {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 48%;
      z-index: 1;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-wt-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .sheet-dvpp .cert-wt-shapes-svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* Spodní lišta jako WebinarCard (bez tlačítka) */
    .sheet-dvpp .cert-wc-bar {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px 12px;
      background: transparent;
    }
    .sheet-dvpp .cert-wc-date {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 10px;
      padding: 6px 10px;
      min-width: 46px;
    }
    .sheet-dvpp .cert-wc-day {
      font-size: 18px;
      font-weight: 800;
      color: #001158;
      line-height: 1;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-mon {
      font-size: 10px;
      color: rgba(0, 17, 88, 0.55);
      line-height: 1.2;
      text-align: center;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-time {
      font-size: 11px;
      font-weight: 700;
      color: #ff8c00;
      line-height: 1;
      margin-top: 4px;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-bar-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    .sheet-dvpp .cert-wc-bar-title {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      color: #001158;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }
    .sheet-dvpp .cert-wc-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sheet-dvpp .cert-wc-pill {
      font-size: 8px;
      font-weight: 600;
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      color: #001158;
      background: #fff;
      line-height: 1.2;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-content-col {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 12px 12px 8px 14px;
      border-right: 1px solid rgba(0, 17, 97, 0.1);
      background: #fff;
    }
    .sheet-dvpp .footer-wrap.footer-dvpp-full {
      margin-top: auto;
      padding: 10px 14px 12px;
      width: 100%;
      flex-shrink: 0;
    }
    .sheet-dvpp .footer-dvpp-full .footer-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 1fr);
      gap: 10px 14px;
      font-size: 9px;
    }
    .sheet-dvpp .cert-content-head {
      text-align: center;
      flex-shrink: 0;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0, 17, 97, 0.12);
    }
    .sheet-dvpp .cert-logo-img-wrap {
      margin: 0 auto 10px;
      text-align: center;
    }
    .sheet-dvpp .cert-logo-svg {
      display: block;
      margin: 0 auto;
      width: 100%;
      max-width: 150px;
      height: auto;
    }
    .sheet-dvpp .cert-kicker {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #6366f1;
    }
    .sheet-dvpp .cert-main-title {
      margin: 0 0 6px;
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 28px;
      font-weight: 300;
      line-height: 1.15;
      color: #001161;
      font-synthesis: none;
    }
    .sheet-dvpp .cert-subtitle {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      letter-spacing: 0.02em;
    }
    .sheet-dvpp .cert-participant-wrap {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 12px 0;
    }
    .sheet-dvpp .cert-participant {
      width: 100%;
      margin: 0;
      padding: 16px 18px;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      border: 1px solid rgba(0, 17, 97, 0.12);
      box-shadow: none;
      border-left: 5px solid #f5d645;
    }
    .sheet-dvpp .cert-participant-label {
      margin: 0 0 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #64748b;
    }
    .sheet-dvpp .cert-name {
      margin: 0 0 8px;
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 22px;
      font-weight: 300;
      color: #001161;
      line-height: 1.2;
      font-synthesis: none;
    }
    .sheet-dvpp .cert-dob {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.45;
    }
    .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #001161; font-weight: 600; margin-bottom: 8px; }
    h1 {
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 20px;
      font-weight: 300;
      line-height: 1.25;
      margin: 0 0 14px;
      color: #001161;
    }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; line-height: 1.5; }
    .meta strong { color: #0f172a; }
    p.text {
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 12px;
    }
    .participant {
      margin: 14px 0;
      padding: 14px 16px;
      background: #e8ebf4;
      border-radius: 10px;
      border-left: 4px solid #001161;
    }
    .participant .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; }
    .participant .name {
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 17px;
      font-weight: 300;
      color: #001161;
    }
    .participant .em { font-size: 12px; color: #475569; margin-top: 4px; }
    .birth { font-size: 12px; color: #334155; margin-top: 8px; }
    .body-note { font-size: 11px; margin-top: 8px; }
    .footer-wrap {
      margin-top: auto;
      padding: 14px 22px 18px;
      border-top: 2px solid #c7d2fe;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 1fr);
      gap: 10px 14px;
      align-items: start;
      font-size: 9px;
      line-height: 1.35;
      color: #1e293b;
    }
    .footer-h {
      margin: 0 0 4px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #001161;
    }
    .footer-sub { margin: 0 0 2px; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .footer-strong { margin: 0 0 4px; font-weight: 700; font-size: 10px; }
    .footer-meta { margin: 0; font-size: 9px; color: #475569; }
    .footer-p { margin: 0 0 6px; }
    .footer-p strong { color: #0f172a; }
    .footer-small { margin: 0; font-size: 8px; color: #64748b; }
    .footer-col-wide .footer-p { font-size: 9px; }
    .footer-simple { font-size: 10px; color: #475569; }
    .footer-simple .footer-p { margin: 0 0 6px; }
    .sheet-preview.sheet-feedback .footer-wrap,
    .sheet-preview .footer-wrap {
      margin-top: 16px;
    }
    .sheet-dvpp.sheet-preview .cert-inner.cert-dvpp-frame {
      min-height: 400px;
    }
    @media print {
      html, body {
        height: 100%;
        background: #ffffff !important;
        color: #0f172a;
        color-scheme: only light;
      }
      .footer-grid { break-inside: avoid; }
      .sheet-dvpp {
        min-height: 186mm;
        page-break-inside: avoid;
      }
      .sheet-dvpp .cert-inner.cert-dvpp-frame {
        break-inside: avoid;
        min-height: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="${_}">
    ${j==="dvpp"?ye:ge}
  </div>
</body>
</html>`}function et({srcDoc:t,className:s="",iframeRef:o}){return e.jsxs("div",{className:`w-full text-left ${s}`,children:[e.jsx("p",{className:"mb-2 text-[11px] font-bold uppercase tracking-wider text-[#001161]/50",children:"Náhled"}),e.jsx("div",{className:"overflow-hidden rounded-xl border border-[#001161]/12 bg-slate-100 shadow-inner",children:e.jsx("iframe",{ref:o,title:"Náhled potvrzení",srcDoc:t,className:"block aspect-[297/210] h-auto w-full border-0 bg-white"})}),e.jsx("p",{style:oe,className:"mt-2 text-center text-[11px] text-[#001161]/45",children:"Stejné zobrazení jako při tisku nebo PDF"})]})}function ls({webinar:t,email:s,participantName:o="",participantBirthDateIso:x="",participantSchoolName:l="",participantSchoolIco:j="",variant:E="default",certificateKind:D}){const L=E==="fullscreen",k=(x||"").trim(),N=(o||"").trim().length>0,c=/^\d{4}-\d{2}-\d{2}$/.test(k),C=D==="dvpp"&&N&&c,y=D==="dvpp",[F,d]=n.useState(()=>y&&!C),[f,p]=n.useState(()=>(o||"").trim()),[u,i]=n.useState(()=>k),[I,m]=n.useState(!1),[b,J]=n.useState(""),[W,Z]=n.useState(!1),G=n.useRef(null),T=n.useMemo(()=>y?/^\d{4}-\d{2}-\d{2}$/.test(u.trim()):!0,[y,u]),S=f.trim().length>0&&T,z=n.useMemo(()=>qe({webinar:t,email:s,participantName:f.trim()||o,birthDateIso:y?u.trim():void 0,kind:D,previewMode:!0}),[t,s,o,f,u,D,y]),g=n.useCallback(async()=>{const $=G.current?.contentDocument;if(!$){Ie.error("Náhled ještě není připraven — zkuste za chvíli znovu.");return}const A=$.querySelector(".sheet");if(!A){Ie.error("Certifikát v náhledu nebyl nalezen.");return}Z(!0);try{await $.fonts?.ready,await new Promise(re=>{requestAnimationFrame(()=>requestAnimationFrame(()=>re()))});const{toPng:H}=await kt(async()=>{const{toPng:re}=await import("./index-BeoRn2gJ.js");return{toPng:re}},[]),q=await H(A,{pixelRatio:Xt,cacheBust:!0,backgroundColor:"#ffffff"}),te=String(t.slug||t.id||"webinar").replace(/[^a-zA-Z0-9-_]+/g,"-"),K=document.createElement("a");K.download=`certifikat-dvpp-${te}.png`,K.href=q,K.rel="noopener",K.click()}catch(H){console.error("[certificate] PNG export",H),Ie.error(H instanceof Error?H.message:"PNG se nepodařilo vytvořit.")}finally{Z(!1)}},[t.id,t.slug]),v=n.useCallback(()=>{const h=qe({webinar:t,email:s,participantName:f.trim()||o,birthDateIso:y?u.trim():void 0,kind:D}),$=new Blob([h],{type:"text/html;charset=utf-8"}),A=URL.createObjectURL($),H=window.open(A,"_blank");if(!H){URL.revokeObjectURL(A);return}let q=!1;const te=()=>{if(!q){q=!0;try{H.focus(),H.print()}catch{}window.setTimeout(()=>{try{URL.revokeObjectURL(A)}catch{}},1500)}};H.addEventListener("load",te,{once:!0}),window.setTimeout(te,600)},[t,s,o,f,u,D,y]),_=n.useCallback(async()=>{if(!y)return!0;J(""),m(!0);try{const h=await fetch(`${Kt}/webinar-dvpp-certificate-profile`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:f.trim(),birthDateIso:u.trim(),schoolName:(l||"").trim(),schoolIco:(j||"").replace(/\D/g,"").slice(0,10)})}),$=await h.json().catch(()=>({}));if(!h.ok)throw new Error($.error||`HTTP ${h.status}`);return!0}catch(h){return J(h instanceof Error?h.message:"Chyba"),!1}finally{m(!1)}},[y,t.id,s,f,u,l,j]),R=n.useRef(!1);return n.useEffect(()=>{!C||F||R.current||(R.current=!0,_())},[C,F,_]),F&&y?e.jsxs(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.35},className:L?"flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10":"w-full mt-6 border-t border-[#001161]/10 pt-8",children:[e.jsxs("div",{className:L?"w-full max-w-md":"mx-auto w-full max-w-[480px]",children:[e.jsx("h2",{style:Ye,className:"text-[18px] font-normal text-[#001161] sm:text-[20px]",children:"Údaje pro certifikát"}),e.jsx("p",{style:oe,className:"mt-2 text-[13px] leading-relaxed text-[#001161]/70",children:"Zkontrolujte jméno a doplňte datum narození. Údaje se uloží pro certifikát (bez nutnosti být registrovaný na webinář). Mailchimp se doplní jen pokud tam už kontakt máte. Propíšou se do tisku a PDF."}),e.jsxs("div",{className:"mt-6 flex flex-col gap-4 text-left",children:[e.jsxs("label",{style:oe,className:"block",children:[e.jsx("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:"Jméno a příjmení"}),e.jsx("input",{type:"text",value:f,onChange:h=>p(h.target.value),className:"w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40",autoComplete:"name"})]}),e.jsxs("label",{style:oe,className:"block",children:[e.jsx("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:"E-mail"}),e.jsx("input",{type:"email",value:s,readOnly:!0,className:"w-full cursor-not-allowed rounded-xl border border-[#001161]/10 bg-slate-50 px-4 py-3 text-[15px] text-[#001161]/70"})]}),e.jsxs("label",{style:oe,className:"block",children:[e.jsxs("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:["Datum narození"," ",e.jsx("span",{className:"text-red-600",children:"*"})]}),e.jsx("input",{type:"date",value:u,onChange:h=>i(h.target.value),className:"w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40",required:!0})]})]})]}),e.jsx(et,{srcDoc:z,iframeRef:G,className:"mx-auto mt-8 w-full max-w-[min(920px,100%)] px-0"}),e.jsx("div",{className:"mx-auto mt-4 flex w-full max-w-[min(920px,100%)] justify-center px-0",children:e.jsxs("button",{type:"button",onClick:()=>void g(),disabled:W,className:"inline-flex items-center justify-center gap-2 rounded-xl border border-[#001161]/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50",style:oe,children:[e.jsx(Ze,{className:"h-4 w-4 shrink-0"}),W?"Generuji PNG…":"Stáhnout PNG (4× rozlišení)"]})}),e.jsxs("div",{className:L?"w-full max-w-md":"mx-auto w-full max-w-[480px]",children:[b?e.jsx("p",{style:oe,className:"mt-4 text-[12px] text-red-600",children:b}):null,e.jsx("button",{type:"button",disabled:!S||I,onClick:async()=>{await _()&&d(!1)},className:"mt-6 w-full rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40",style:oe,children:I?"Ukládám…":"Pokračovat k potvrzení a PDF"})]})]}):e.jsx(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.35},className:L?"flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10":"w-full mt-6 border-t border-[#001161]/10 pt-8",children:e.jsxs("div",{className:L?"w-full max-w-[min(920px,100%)] text-center":"mx-auto w-full max-w-[min(920px,100%)] text-center",children:[e.jsx("div",{className:"mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#001161]/8",children:e.jsx(Vt,{className:"h-9 w-9 text-[#001161]",strokeWidth:1.5})}),e.jsx("h2",{style:Ye,className:"text-[20px] font-normal leading-snug text-[#001161] sm:text-[22px]",children:D==="dvpp"?"Hotovo — máte splněné ověření znalostí (DVPP)":"Děkujeme za vyplnění dotazníku"}),e.jsx("p",{style:oe,className:"mt-3 text-[14px] leading-relaxed text-[#001161]/70",children:D==="dvpp"?"Níže je náhled stejný jako při tisku / PDF. PNG lze stáhnout ve vysokém rozlišení (4×); PDF přes tisk v prohlížeči (Uložit jako PDF).":"Níže je náhled; můžete vytisknout nebo uložit potvrzení o vyplnění zpětné vazby (PNG ve 4× rozlišení nebo PDF přes tisk)."}),e.jsx(et,{srcDoc:z,iframeRef:G,className:"mx-auto mt-8"}),e.jsxs("div",{className:"mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center",children:[e.jsxs("button",{type:"button",onClick:v,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:scale-[1.02]",style:oe,children:[e.jsx(Mt,{className:"h-4 w-4 shrink-0"}),"Stáhnout PDF (tisk → Uložit jako PDF)"]}),e.jsxs("button",{type:"button",onClick:()=>void g(),disabled:W,className:"inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#001161]/12 bg-white px-6 py-3 text-[14px] font-bold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50",style:oe,children:[e.jsx(Ze,{className:"h-4 w-4 shrink-0"}),W?"Generuji PNG…":"Stáhnout PNG (4× rozlišení)"]})]}),y?e.jsx("button",{type:"button",onClick:()=>d(!0),className:"mt-4 text-[13px] font-semibold text-[#001161]/50 underline-offset-2 hover:text-[#001161]/80 hover:underline",style:oe,children:"Upravit údaje pro certifikát"}):null,e.jsx("p",{style:oe,className:"mt-4 text-[12px] text-[#001161]/45",children:"V Chrome nebo Edge v okně tisku zvolte „Uložit jako PDF“. Obsah potvrzení odpovídá údajům o webináři a údajům v certifikátu."})]})})}const cs="#001161";function Ne({total:t,filled:s,className:o=""}){if(t<=0)return null;const x=Math.max(0,Math.min(s,t));return e.jsx("div",{className:`flex justify-center gap-1 px-2 ${o}`,role:"progressbar","aria-valuenow":x,"aria-valuemin":0,"aria-valuemax":t,children:Array.from({length:t},(l,j)=>e.jsx("div",{className:"h-1.5 min-w-[6px] max-w-[40px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[48px]",style:{backgroundColor:j<x?cs:"rgba(0,17,97,0.12)"}},j))})}const ee={fontFamily:"'Fenomen Sans', sans-serif"},tt={fontFamily:"'Cooper Light', serif"},ds="#E8EBF4",ie="#001161",st="#4E5871",nt="#7C3AED",at="#C2DFFF";function ps({webinarTitle:t,questions:s,answers:o,onAnswerChange:x,onComplete:l,variant:j="default",flowProgressTotal:E,flowProgressFilled:D,onStepChange:L,onSavePartialAnswer:k}){const N=j==="fullscreen",c=s.length,[C,y]=n.useState(""),F=n.useRef(0),[d,f]=n.useState(-1),p=n.useRef(d),[u,i]=n.useState(null);n.useEffect(()=>{p.current=d},[d]),n.useEffect(()=>{L?.(d)},[d,L]),n.useEffect(()=>{y(""),i(null)},[d]);const I=d<0?0:Math.min(d+1,c),m=typeof E=="number"&&E>0&&typeof D=="number",b=d>=0&&d<c?s[d]:null,J=b?o[b.id]:void 0,W=n.useCallback((S,z)=>{y(""),i(null);const g=p.current;if(x(S,z),!k)return;const v=++F.current;(async()=>{try{const _=await k(S,z);if(F.current!==v||p.current!==g)return;_&&typeof _=="object"&&_.wrongAnswer?i("wrong"):i("correct")}catch(_){if(F.current!==v||p.current!==g)return;y(_ instanceof Error?_.message:"Uložení se nezdařilo"),i(null)}})()},[x,k]),Z=n.useCallback(()=>{f(S=>Math.max(-1,S-1))},[]),G=n.useCallback(()=>{if(d===-1){f(0);return}if(d>=0&&d<c){if(!J||C)return;if(d===c-1){l();return}f(S=>S+1)}},[d,c,J,C,l]);if(c===0)return null;const T=["A","B","C","D"];return N?e.jsxs("div",{className:"relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]",style:{backgroundColor:ds},children:[e.jsxs("div",{className:`pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0`,children:[e.jsx("button",{type:"button",onClick:Z,disabled:d<=-1,className:"pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30","aria-label":"Zpět",children:e.jsx(Fe,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:G,disabled:d===-1?!1:d>=0&&d<c?!J||!!C:!0,className:"pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35","aria-label":d===c-1?"Dokončit":"Další",children:e.jsx(Ae,{className:"h-7 w-7"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0",children:[e.jsx("div",{className:"mb-3 shrink-0 pt-1 sm:mb-4",children:m?e.jsx(Ne,{total:E,filled:D}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:c},(S,z)=>e.jsx("div",{className:"h-1.5 max-w-[56px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[64px]",style:{backgroundColor:z<I?ie:"rgba(0,17,97,0.1)"}},z))})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]",children:e.jsx("div",{className:"flex min-h-0 flex-1 flex-col",children:e.jsxs(ke,{mode:"wait",children:[d===-1&&e.jsx(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5",children:e.jsxs("div",{className:"flex min-h-0 w-full flex-1 flex-col justify-center rounded-[18px] border-4 px-5 py-8 text-center shadow-inner sm:rounded-[22px] sm:px-8 sm:py-12 md:px-12",style:{borderColor:ie,backgroundColor:at},children:[e.jsx("p",{style:{...ee,color:ie},className:"text-[16px] font-medium sm:text-[18px]",children:"Vědomostní test pro získání"}),e.jsx("p",{style:{...tt,color:ie},className:"mt-4 text-[clamp(1.75rem,5vw,2.75rem)] leading-tight tracking-tight",children:"Certifikátu DVPP"}),e.jsxs("p",{style:{...ee,color:ie},className:"mt-6 text-[15px] leading-relaxed opacity-90 sm:text-[16px]",children:["Po webináři ",e.jsx("span",{className:"font-semibold",children:`„${t}“`})]}),e.jsx("p",{style:{...ee,color:ie},className:"mt-5 max-w-xl mx-auto text-[14px] leading-relaxed opacity-85 sm:text-[15px]",children:"Certifikát se vám po úspěšném absolvování vědomostního testu zobrazí sám."})]})},"intro"),b&&e.jsxs(U.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain md:overflow-hidden",children:[e.jsx("div",{className:"flex min-h-0 shrink-0 flex-col items-center justify-center px-6 pb-7 pt-8 sm:px-8 sm:pb-6 sm:pt-7 md:flex md:min-h-0 md:flex-[1.15] md:px-14 md:py-6",children:e.jsx("p",{style:{...ee,color:st},className:"max-w-4xl text-center text-[clamp(1.05rem,4.2vw,1.85rem)] font-bold leading-snug sm:text-[clamp(1.1rem,3.5vw,2.05rem)] md:leading-relaxed md:text-[1.85rem] lg:text-[2.1rem]",children:b.label})}),e.jsxs("div",{className:"flex min-h-0 shrink-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pb-7 md:flex md:flex-1 md:justify-end md:pb-7",children:[e.jsx("div",{className:"mx-auto grid w-full max-w-4xl grid-cols-1 gap-2.5 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 md:px-10",children:b.options.slice(0,4).map((S,z)=>{const g=T[z],v=o[b.id]===S,_=v&&u!==null,R=_&&u==="correct",h=_&&u==="wrong";return e.jsxs("button",{type:"button",onClick:()=>W(b.id,S),className:`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${R?"border-emerald-500 bg-emerald-50 shadow-sm":h?"border-red-500 bg-red-50 shadow-sm":v?"border-indigo-500 bg-indigo-50 shadow-sm":"border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md"}`,children:[e.jsx("span",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold md:h-10 md:w-10 md:text-[14px]",style:{...ee,backgroundColor:R?"rgba(16,185,129,0.25)":h?"rgba(239,68,68,0.22)":v?"#c7d2fe":"#cbd5e1",color:R?"#047857":h?"#b91c1c":v?"#3730a3":"#475569"},children:g}),e.jsx("span",{style:{...ee,color:R?"#065f46":h?"#991b1b":st},className:"flex min-h-[48px] flex-1 items-center text-[16px] font-medium leading-snug md:text-[18px] md:leading-relaxed",children:S})]},`${b.id}-${z}`)})}),C?e.jsx("p",{style:ee,className:"mt-4 text-center text-[12px] text-red-600 sm:mt-5",children:C}):null,e.jsxs("p",{style:{...ee},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[d+1," / ",c]})]})]},b.id)]})})})]})]}):e.jsxs("div",{className:"relative flex min-h-0 w-full flex-col rounded-[24px] py-6 px-3 sm:px-6 md:px-10",style:{backgroundColor:"#F3F5FA"},children:[e.jsxs("div",{className:"pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-0 sm:px-1 md:-mx-2",children:[e.jsx("button",{type:"button",onClick:Z,disabled:d<=-1,className:"pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35 disabled:hover:bg-white","aria-label":"Zpět",children:e.jsx(Fe,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:G,disabled:d===-1?!1:d>=0&&d<c?!J||!!C:!0,className:"pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35",style:{backgroundColor:nt},"aria-label":d===c-1?"Dokončit":"Další",children:e.jsx(Ae,{className:"h-6 w-6"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6",children:[e.jsx("div",{className:"mb-6",children:m?e.jsx(Ne,{total:E,filled:D,className:"mb-0"}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:c},(S,z)=>e.jsx("div",{className:"h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300",style:{backgroundColor:z<I?ie:"rgba(0,17,97,0.12)"}},z))})}),e.jsxs(ke,{mode:"wait",children:[d===-1&&e.jsxs(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"rounded-[20px] border-4 p-6 text-center shadow-sm sm:p-10",style:{borderColor:ie,backgroundColor:at},children:[e.jsx("p",{style:{...ee,color:ie},className:"text-[15px] font-medium sm:text-[16px]",children:"Vědomostní test pro získání"}),e.jsx("p",{style:{...tt,color:ie},className:"mt-3 text-[28px] leading-tight tracking-tight sm:text-[36px]",children:"Certifikátu DVPP"}),e.jsxs("p",{style:{...ee,color:ie},className:"mt-5 text-[14px] leading-relaxed opacity-90 sm:text-[15px]",children:["Po webináři ",e.jsx("span",{className:"font-semibold",children:`„${t}“`})]}),e.jsx("p",{style:{...ee,color:ie},className:"mt-4 max-w-md mx-auto text-[13px] leading-relaxed opacity-85 sm:text-[14px]",children:"Po úspěšném dokončení testu se certifikát zobrazí automaticky v dalším kroku."})]},"intro"),b&&e.jsxs(U.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"rounded-[22px] bg-white p-6 shadow-[0_8px_40px_rgba(0,17,97,0.08)] ring-1 ring-[#001161]/6 sm:p-8",children:[e.jsx("p",{style:{...ee,color:"#334155"},className:"text-center text-[21px] font-bold leading-snug sm:text-[24px] sm:leading-snug",children:b.label}),e.jsx("div",{className:"mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2",children:b.options.slice(0,4).map((S,z)=>{const g=T[z],v=o[b.id]===S,_=v&&u!==null,R=_&&u==="correct",h=_&&u==="wrong";return e.jsxs("button",{type:"button",onClick:()=>W(b.id,S),className:`flex w-full items-stretch gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all ${R?"border-emerald-500 bg-emerald-50 shadow-sm":h?"border-red-500 bg-red-50 shadow-sm":v?"border-[#7C3AED] bg-[#7C3AED]/[0.06] shadow-sm":"border-[#E2E8F0] bg-white hover:border-[#001161]/20 hover:bg-slate-50/80"}`,children:[e.jsx("span",{className:"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold",style:{...ee,color:R?"#047857":h?"#b91c1c":v?nt:"#64748B",backgroundColor:R?"rgba(16,185,129,0.2)":h?"rgba(239,68,68,0.18)":v?"rgba(124,58,237,0.12)":"#F1F5F9"},children:g}),e.jsx("span",{style:{...ee,color:R?"#065f46":h?"#991b1b":"#334155"},className:"flex min-h-[44px] items-center text-[16px] font-normal leading-snug sm:text-[17px]",children:S})]},`${b.id}-${z}`)})}),C?e.jsx("p",{style:ee,className:"mt-4 text-center text-[12px] text-red-600",children:C}):null,e.jsxs("p",{style:{...ee},className:"mt-6 text-center text-[12px] text-slate-400",children:[d+1," / ",c]})]},b.id)]})]})]})}const se={fontFamily:"'Fenomen Sans', sans-serif"},ms="#E8EBF4",ot="#001161",Ee="#4E5871",xs="#7C3AED",rt="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-2.5 text-[14px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45";function it(t,s){return t.type==="intro"?!0:!!s[t.id]?.trim()}function us({steps:t,answers:s,onAnswerChange:o,onComplete:x,variant:l="default",flowProgressTotal:j,flowProgressFilled:E,onStepChange:D,onSavePartialAnswer:L}){const k=l==="fullscreen",N=t.length,[c,C]=n.useState(0),[y,F]=n.useState(!1),[d,f]=n.useState(""),[p,u]=n.useState(!1),i=n.useRef(!1),I=n.useRef(!1),m=N>0?t[c]:null,b=c;n.useEffect(()=>{D?.(c)},[c,D]),n.useEffect(()=>{f("")},[c]);const J=typeof j=="number"&&j>0&&typeof E=="number",W=n.useCallback(()=>{C(g=>Math.max(0,g-1))},[]),Z=n.useCallback(()=>{!m||N===0||it(m,s)&&(i.current||y||(i.current=!0,u(!0),(async()=>{try{if(L&&m.type!=="intro"){let g="";if((m.type==="open"||m.type==="abc")&&(g=(s[m.id]||"").trim()),g)try{await L(m.id,g)}catch(v){f(v instanceof Error?v.message:"Uložení se nezdařilo");return}}if(c>=N-1){x();return}C(g=>g+1)}finally{i.current=!1,u(!1)}})()))},[m,s,c,N,x,L,y]),G=n.useCallback(async()=>{if(!m||m.type==="intro"||!L||I.current)return;let g="";if(m.type==="open")g=(s[m.id]||"").trim();else if(m.type==="abc")g=(s[m.id]||"").trim();else return;if(g){I.current=!0,f(""),F(!0);try{await L(m.id,g)}catch(v){f(v instanceof Error?v.message:"Uložení se nezdařilo")}finally{I.current=!1,F(!1)}}},[m,s,L]);if(N===0||!m)return null;const T=["A","B","C","D"],S=()=>m.type==="intro"?e.jsx(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5",children:e.jsxs("div",{className:"flex min-h-0 w-full flex-1 flex-row items-center gap-4 rounded-[20px] px-5 py-8 shadow-inner sm:gap-8 sm:rounded-[28px] sm:px-8 sm:py-10 md:px-12",style:{backgroundColor:"#475569"},children:[e.jsx("div",{className:"flex shrink-0 items-center justify-center text-[clamp(3.5rem,12vw,5rem)] leading-none","aria-hidden":!0,children:"🤔"}),e.jsxs("div",{className:"min-w-0 flex-1 text-left",children:[e.jsx("p",{style:{...se,color:"#fff"},className:"text-[clamp(1.1rem,3vw,1.45rem)] font-semibold leading-snug",children:m.title}),m.subtitle?e.jsx("p",{style:{...se,color:"rgba(255,255,255,0.85)"},className:"mt-3 text-[16px] leading-relaxed sm:text-[17px]",children:m.subtitle}):null]})]})},m.id):m.type==="open"?e.jsxs(U.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-12 sm:py-8 md:px-14",children:[e.jsxs("div",{className:"flex min-h-0 flex-1 flex-col items-center",children:[e.jsx("p",{style:{...se,color:Ee},className:"max-w-4xl text-center text-[clamp(1.3rem,3.2vw,1.85rem)] font-bold leading-snug md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]",children:m.label}),m.sublabel?e.jsx("p",{style:{...se,color:Ee},className:"mt-4 max-w-4xl text-center text-[16px] leading-relaxed opacity-90 sm:text-[17px]",children:m.sublabel}):null,e.jsx("textarea",{value:s[m.id]||"",onChange:g=>o(m.id,g.target.value),placeholder:m.placeholder||"Vaše odpověď",rows:k?8:5,className:"mt-6 w-full max-w-4xl flex-1 min-h-[140px] resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-[15px] text-[#334155] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 sm:min-h-[180px] md:text-[16px]",style:se}),L?e.jsxs("div",{className:"mt-5 flex w-full max-w-4xl flex-col items-center gap-2",children:[e.jsxs("button",{type:"button",disabled:y||p||!(s[m.id]||"").trim(),onClick:()=>void G(),className:rt,style:se,children:[y?e.jsx(ce,{className:"h-4 w-4 animate-spin"}):null,"Odpovědět"]}),d?e.jsx("p",{style:se,className:"text-center text-[12px] text-red-600",children:d}):null]}):null]}),e.jsxs("p",{style:{...se},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[c+1," / ",N]})]},m.id):e.jsxs(U.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain md:overflow-hidden",children:[e.jsx("div",{className:"flex min-h-0 shrink-0 flex-col items-center justify-center px-6 pb-7 pt-8 sm:px-10 sm:pb-6 sm:pt-7 md:flex md:min-h-0 md:flex-[1.05] md:px-14 md:py-6",children:e.jsx("p",{style:{...se,color:Ee},className:"max-w-4xl text-center text-[clamp(1.05rem,4vw,1.85rem)] font-bold leading-snug sm:text-[clamp(1.2rem,3.2vw,1.85rem)] md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]",children:m.label})}),e.jsxs("div",{className:"flex min-h-0 shrink-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pb-7 md:flex md:flex-1 md:justify-end md:pb-7",children:[e.jsx("div",{className:"mx-auto grid w-full max-w-4xl grid-cols-1 gap-2.5 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 md:px-10",children:m.options.slice(0,4).map((g,v)=>{const _=T[v],R=s[m.id]===g;return e.jsxs("button",{type:"button",onClick:()=>o(m.id,g),className:`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${R?"border-indigo-500 bg-indigo-50 shadow-sm":"border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md"}`,children:[e.jsx("span",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold md:h-10 md:w-10 md:text-[14px]",style:{...se,backgroundColor:R?"#c7d2fe":"#cbd5e1",color:R?"#3730a3":"#475569"},children:_}),e.jsx("span",{style:{...se,color:Ee},className:"flex min-h-[48px] flex-1 items-center text-[16px] font-medium leading-snug md:text-[18px] md:leading-relaxed",children:g})]},`${m.id}-${v}`)})}),L&&s[m.id]?.trim()?e.jsxs("div",{className:"mx-auto mt-4 flex w-full max-w-4xl flex-col items-center gap-2 px-4 sm:px-6 md:px-10",children:[e.jsxs("button",{type:"button",disabled:y||p,onClick:()=>void G(),className:rt,style:se,children:[y?e.jsx(ce,{className:"h-4 w-4 animate-spin"}):null,"Odpovědět"]}),d?e.jsx("p",{style:se,className:"text-center text-[12px] text-red-600",children:d}):null]}):null,e.jsxs("p",{style:{...se},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[c+1," / ",N]})]})]},m.id),z=!it(m,s)||p||y;return k?e.jsxs("div",{className:"relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]",style:{backgroundColor:ms},children:[e.jsxs("div",{className:`pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0`,children:[e.jsx("button",{type:"button",onClick:W,disabled:c<=0,className:"pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30","aria-label":"Zpět",children:e.jsx(Fe,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:Z,disabled:z,className:"pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35","aria-label":c>=N-1?"Dokončit":"Další",children:e.jsx(Ae,{className:"h-7 w-7"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0",children:[e.jsx("div",{className:"mb-3 shrink-0 pt-1 sm:mb-4",children:J?e.jsx(Ne,{total:j,filled:E}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:N},(g,v)=>e.jsx("div",{className:"h-1.5 max-w-[56px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[64px]",style:{backgroundColor:v<b?ot:"rgba(0,17,97,0.1)"}},v))})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]",children:e.jsx("div",{className:"flex min-h-0 flex-1 flex-col",children:e.jsx(ke,{mode:"wait",children:S()})})})]})]}):e.jsxs("div",{className:"relative flex min-h-0 w-full flex-col rounded-[24px] py-6 px-3 sm:px-6 md:px-10",style:{backgroundColor:"#F3F5FA"},children:[e.jsxs("div",{className:"pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-0 sm:px-1 md:-mx-2",children:[e.jsx("button",{type:"button",onClick:W,disabled:c<=0,className:"pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35","aria-label":"Zpět",children:e.jsx(Fe,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:Z,disabled:z,className:"pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35",style:{backgroundColor:xs},"aria-label":c>=N-1?"Dokončit":"Další",children:e.jsx(Ae,{className:"h-6 w-6"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6",children:[e.jsx("div",{className:"mb-6",children:J?e.jsx(Ne,{total:j,filled:E}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:N},(g,v)=>e.jsx("div",{className:"h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300",style:{backgroundColor:v<b?ot:"rgba(0,17,97,0.12)"}},v))})}),e.jsx("div",{className:"min-h-[min(70vh,520px)] overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80",children:e.jsx("div",{className:"flex min-h-[min(70vh,520px)] flex-col",children:e.jsx(ke,{mode:"wait",children:S()})})})]})]})}const fs=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`;function hs(t){const s=t.replace(/\uFEFF/g,"").trim();if(!s)return null;try{return JSON.parse(s)}catch{let o=s;for(let x=0;x<8;x++){const l=o.match(/^(true|false|null)\b\s*(?:,\s*)?/i);if(!l)break;o=o.slice(l[0].length).trim()}return JSON.parse(o)}}async function lt(t){const s=String(t.participantName??"").trim(),o=await fetch(`${fs}/webinar-survey-partial`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.webinarId??"").trim(),email:t.email.trim(),questionId:t.questionId.trim(),value:t.value,...s?{participantName:s}:{}})}),x=await o.text();let l={};try{l=hs(x)||{}}catch{return{ok:!1,error:o.ok?"Neplatná odpověď serveru":`Server (${o.status})`}}return o.ok?l.success?l.wrongAnswer?{ok:!0,wrongAnswer:!0}:{ok:!0}:{ok:!1,error:l.error||"Uložení se nezdařilo"}:o.status===404?{ok:!1,error:"Uložení odpovědi na serveru není k dispozici (404). Je potřeba znovu nasadit Edge funkci make-server-93a20b6f (endpoint webinar-survey-partial)."}:{ok:!1,error:l.error||`HTTP ${o.status}`}}const gs=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,X={fontFamily:"'Fenomen Sans', sans-serif"};function bs(t,s){const o=(s[t.id]||"").trim();return t.type==="open"||t.type==="abc"?o.length>0:t.type==="yes_no"?o==="yes"||o==="no":!0}function _e({onSkip:t,active:s}){return null}function vs(t){const s=t.replace(/\uFEFF/g,"").trim();if(!s)return null;try{return JSON.parse(s)}catch{let o=s;for(let x=0;x<8;x++){const l=o.match(/^(true|false|null)\b\s*(?:,\s*)?/i);if(!l)break;o=o.slice(l[0].length).trim()}return JSON.parse(o)}}function Ue({webinar:t,email:s,onAnswersChange:o,variant:x="default",scope:l="post",participantName:j="",participantBirthDateIso:E="",participantSchoolName:D="",participantSchoolIco:L=""}){const k=x==="fullscreen",N=n.useMemo(()=>l==="pre"?xt(t):ut(t),[t,l]),c=n.useMemo(()=>l==="pre"?new Set:new Set(Bt(t).map(r=>r.id)),[t,l]),C=n.useMemo(()=>l==="post"?Lt(t):new Set,[t,l]),y=n.useMemo(()=>l==="post"?Tt(t):[],[t,l]),F=n.useMemo(()=>N.filter(r=>!c.has(r.id)&&!C.has(r.id)),[N,c,C]),d=n.useMemo(()=>{if(l==="pre")return[];const r=t.postWebinarQuizQuestions;return Array.isArray(r)?r.filter(P=>!!P&&P.type==="abc"&&typeof P.label=="string"&&P.label.trim().length>0&&Array.isArray(P.options)&&P.options.length>=2):[]},[t,l]),[f,p]=n.useState({}),[u,i]=n.useState(!1),[I,m]=n.useState(""),[b,J]=n.useState(!1),[W,Z]=n.useState(!1),[G,T]=n.useState(!1),[S,z]=n.useState(!1),[g,v]=n.useState(-1),[_,R]=n.useState(0),[h,$]=n.useState(null),[A,H]=n.useState(null),[q,te]=n.useState(""),K=n.useMemo(()=>F.every(r=>bs(r,f)),[F,f]);n.useEffect(()=>{o?.(f)},[f,o]);const re=n.useRef(!1);n.useEffect(()=>{v(-1),R(0),re.current=!1},[t.id]);const O=l==="post",le=O&&d.length>0?1+d.length:0,me=O?y.length:0,de=O?1:0,he=O?1:0,Y=O?le+me+de+he:0,ne=d.length>0&&!G,ae=l==="post"&&y.length>0&&!S&&(d.length===0||G),ye=n.useMemo(()=>!O||Y===0?0:b?Y:ne?g<0?0:Math.min(1+g,le):ae?Math.min(le+_,le+me):le+me,[O,Y,b,ne,ae,g,_,le,me]),ge=n.useMemo(()=>{if(!O||Y===0)return 0;if(b)return Y;let r=ye;return!ne&&!ae&&r===0&&Y>0&&(r=1),Math.min(r,Y)},[O,Y,b,ye,ne,ae]),we=n.useCallback(()=>{T(!0),z(!0),J(!0)},[]),be=n.useCallback(async()=>{if(F.length>0&&!K){m("Vyplňte prosím všechny otázky v této části.");return}i(!0),m("");try{const r=await fetch(`${gs}/webinar-survey-submit`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),answers:f})}),P=await r.text();let V={};try{V=vs(P)||{}}catch{const pe=P.trim(),Ge=r.status===404&&(pe==="404 Not Found"||pe==="Not Found"||/^404\b/i.test(pe));throw new Error(Ge?"Dotazník na serveru nenalezen — nasaďte prosím edge funkci make-server-93a20b6f (webinar-survey-submit) nebo zkuste později.":r.ok?"Neplatná odpověđ serveru":`Server (${r.status}): ${P.slice(0,200)}`)}if(!r.ok)throw new Error(V.error||`HTTP ${r.status}`);J(!0)}catch(r){m(r instanceof Error?r.message:"Chyba")}finally{i(!1)}},[f,s,t.id,F.length,K,j]),De=n.useCallback(async(r,P)=>{if(l!=="post")return;const V=await lt({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),questionId:r,value:P});if(!V.ok)throw new Error(V.error||"Chyba");return"wrongAnswer"in V&&V.wrongAnswer?{wrongAnswer:!0}:void 0},[l,t.id,s,j]),We=n.useCallback(async r=>{if(l!=="post")return;const P=(f[r.id]||"").trim();if(P){te(""),$(r.id);try{const V=await lt({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),questionId:r.id,value:P});if(!V.ok)throw new Error(V.error||"Chyba");H(r.id),window.setTimeout(()=>{H(pe=>pe===r.id?null:pe)},2200)}catch(V){te(V instanceof Error?V.message:"Chyba")}finally{$(null)}}},[l,t.id,s,f,j]);return n.useEffect(()=>{l==="post"&&(b||W||N.length!==0&&(ne||ae||F.length>0||u||re.current||(re.current=!0,be())))},[l,b,W,N.length,ne,ae,F.length,u,be]),b?l==="post"?e.jsx("div",{className:k?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"w-full",children:e.jsx(ls,{webinar:t,email:s,participantName:j,participantBirthDateIso:E,participantSchoolName:D,participantSchoolIco:L,variant:k?"fullscreen":"default",certificateKind:d.length>0?"dvpp":"feedback"})}):e.jsx(U.div,{initial:{opacity:0,y:6},animate:{opacity:1,y:0},className:k?"flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center":"w-full mt-6 border-t border-[#001161]/10 pt-6 text-left",children:e.jsx("p",{style:X,className:"text-[13px] text-[#001161]/70",children:"Děkujeme za odpovědi — pomůhá nám to připravit obsah."})}):N.length===0||W?null:ne?e.jsxs(U.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:k?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[e.jsx(ps,{variant:k?"fullscreen":"default",webinarTitle:t.title,questions:d,answers:f,onAnswerChange:(r,P)=>p(V=>({...V,[r]:P})),onComplete:()=>T(!0),flowProgressTotal:Y,flowProgressFilled:ge,onStepChange:v,onSavePartialAnswer:l==="post"?De:void 0},t.id),k?null:e.jsx("div",{className:"mt-4 flex justify-center",children:e.jsx("button",{type:"button",onClick:()=>Z(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:X,children:"Přeskočit celý dotazník"})}),e.jsx(_e,{onSkip:we,active:O})]}):ae?e.jsxs(U.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:k?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[e.jsx(us,{variant:k?"fullscreen":"default",steps:y,answers:f,onAnswerChange:(r,P)=>p(V=>({...V,[r]:P})),onComplete:()=>z(!0),flowProgressTotal:Y,flowProgressFilled:ge,onStepChange:R,onSavePartialAnswer:l==="post"?De:void 0}),k?null:e.jsx("div",{className:"mt-4 flex justify-center",children:e.jsx("button",{type:"button",onClick:()=>Z(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:X,children:"Přeskočit celý dotazník"})}),e.jsx(_e,{onSkip:we,active:O})]}):l==="post"&&F.length===0&&!ne&&!ae?e.jsxs(U.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:k?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[Y>0?e.jsx("div",{className:k?"mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0":"mb-4 flex justify-center",children:e.jsx(Ne,{total:Y,filled:ge})}):null,e.jsx("div",{className:k?"mx-auto flex w-full max-w-[min(720px,100%)] flex-col items-center":"flex flex-col items-center",children:I?e.jsxs(e.Fragment,{children:[e.jsx("p",{style:X,className:"mb-3 text-[13px] text-red-600",children:I}),e.jsxs("div",{className:"mt-2 flex flex-wrap items-center gap-3",children:[e.jsxs("button",{type:"button",disabled:u,onClick:be,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50",style:X,children:[u?e.jsx(ce,{className:"h-4 w-4 animate-spin"}):null,"Odeslat odpovědi"]}),e.jsx("button",{type:"button",disabled:u,onClick:()=>Z(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:X,children:"Přeskočit"})]})]}):e.jsx("div",{className:"flex justify-center py-10","aria-busy":"true","aria-live":"polite",children:e.jsx(ce,{className:"h-8 w-8 animate-spin text-[#001161]"})})}),e.jsx(_e,{onSkip:we,active:O})]}):e.jsxs(U.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:k?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[Y>0?e.jsx("div",{className:k?"mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0":"mb-4 flex justify-center",children:e.jsx(Ne,{total:Y,filled:ge})}):null,e.jsxs("div",{className:k?"mx-auto w-full max-w-[min(720px,100%)]":void 0,children:[F.length>0&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-start gap-3 mb-4",children:[e.jsx("div",{className:"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#001161]/8",children:e.jsx(Ut,{className:"h-5 w-5 text-[#001161]"})}),e.jsx("div",{children:e.jsx("h3",{style:X,className:"text-[16px] font-bold text-[#001161] leading-snug",children:"Pomozte nám porozumět, kdo přichází na webinář"})})]}),e.jsx("div",{className:"space-y-4",children:F.map(r=>e.jsxs("div",{children:[e.jsx("label",{style:X,className:"block text-[13px] font-semibold text-[#001161] mb-1.5",children:r.label}),r.type==="open"&&e.jsx("textarea",{value:f[r.id]||"",onChange:P=>p(V=>({...V,[r.id]:P.target.value})),rows:3,className:"w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",style:X}),r.type==="abc"&&r.options&&r.options.length>0&&e.jsx("div",{className:"flex flex-col gap-2",children:r.options.map(P=>e.jsxs("label",{className:"flex cursor-pointer items-center gap-2 rounded-xl border border-[#001161]/10 bg-white px-3 py-2 text-[14px] text-[#001161] hover:bg-[#F0F2F8]",style:X,children:[e.jsx("input",{type:"radio",name:r.id,checked:f[r.id]===P,onChange:()=>p(V=>({...V,[r.id]:P})),className:"accent-[#001161]"}),P]},P))}),r.type==="yes_no"&&e.jsx("div",{className:"flex flex-wrap gap-2",children:[{v:"yes",l:"Ano"},{v:"no",l:"Ne"}].map(({v:P,l:V})=>e.jsx("button",{type:"button",onClick:()=>p(pe=>({...pe,[r.id]:P})),className:`rounded-xl px-4 py-2 text-[14px] font-bold transition-all ${f[r.id]===P?"bg-[#001161] text-white shadow-md":"bg-[#F0F2F8] text-[#001161] hover:bg-[#e4e8f4]"}`,style:X,children:V},P))}),l==="post"?e.jsxs("div",{className:"mt-3 flex flex-wrap items-center gap-2",children:[e.jsxs("button",{type:"button",disabled:h===r.id||!(r.type==="open"&&(f[r.id]||"").trim()||r.type==="abc"&&r.options&&r.options.length>0&&(f[r.id]||"").trim()||r.type==="yes_no"&&(f[r.id]==="yes"||f[r.id]==="no")),onClick:()=>void We(r),className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2 text-[13px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45",style:X,children:[h===r.id?e.jsx(ce,{className:"h-3.5 w-3.5 animate-spin"}):null,"Odpovědět"]}),A===r.id?e.jsxs("span",{style:X,className:"inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600",children:[e.jsx(Wt,{className:"h-3.5 w-3.5 shrink-0"}),"Uloženo"]}):null]}):null]},r.id))}),l==="post"&&q?e.jsx("p",{style:X,className:"mt-2 text-[13px] text-red-600",children:q}):null]}),I?e.jsx("p",{style:X,className:"mt-3 text-[13px] text-red-600",children:I}):null,e.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-3",children:[e.jsxs("button",{type:"button",disabled:u||F.length>0&&!K,onClick:be,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50",style:X,children:[u?e.jsx(ce,{className:"h-4 w-4 animate-spin"}):null,"Odeslat odpovědi"]}),e.jsx("button",{type:"button",disabled:u,onClick:()=>Z(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:X,children:"Přeskočit"})]}),e.jsx(_e,{onSkip:we,active:O})]})]})}function ys({form:t,notTeacher:s,onTogglePedagogMode:o,handleChange:x,handleSubmit:l,handleSchoolNameChange:j,handleSchoolSelect:E,handleIcoChange:D,schoolContainerRef:L,schoolResults:k,schoolOpen:N,setSchoolOpen:c,schoolSearching:C,error:y,submitting:F,positions:d,submitButtonText:f="Přihlásit"}){return e.jsxs("form",{onSubmit:l,noValidate:!0,className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"flex items-center justify-between bg-white rounded-[12px] px-4 py-3 border border-[#001161]/10",children:[e.jsxs("div",{children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-[#001161] leading-tight",children:s?"Nejsem pedagog":"Jsem pedagog"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 leading-tight mt-0.5",children:s?"Nepotřebuji certifikát DVPP":"Po webináři obdržím certifikát DVPP"})]}),e.jsx("button",{type:"button",onClick:o,className:`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#001161]/30 ${s?"bg-red-500":"bg-emerald-600"}`,"aria-checked":!s,role:"switch","aria-label":s?"Zapnout režim pedagog s certifikátem DVPP":"Vypnout — nejsem pedagog",children:e.jsx("span",{className:`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${s?"translate-x-0":"translate-x-5"}`})})]}),e.jsx(ke,{initial:!1,children:!s&&e.jsxs(U.div,{initial:{opacity:0,height:0},animate:{opacity:1,height:"auto"},exit:{opacity:0,height:0},transition:{duration:.22},className:"flex flex-col gap-3 overflow-visible",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-1 pl-1",children:"Informace o škole"}),e.jsxs("div",{ref:L,className:"relative",children:[e.jsx("input",{type:"text",value:t.schoolName,onChange:p=>j(p.target.value),onFocus:()=>k.length>0&&c(!0),placeholder:" Název školy",autoComplete:"off",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30",children:C?e.jsx(ce,{className:"w-4 h-4 animate-spin"}):e.jsx(ft,{className:"w-4 h-4"})}),e.jsx(ke,{children:N&&k.length>0&&e.jsx(U.div,{initial:{opacity:0,y:-6},animate:{opacity:1,y:0},exit:{opacity:0,y:-6},transition:{duration:.15},className:"absolute z-[100] mt-1 w-full bg-white border border-[#001161]/10 rounded-2xl shadow-xl overflow-hidden",children:e.jsx("div",{className:"max-h-[220px] overflow-y-auto py-1",children:k.map((p,u)=>e.jsxs("button",{type:"button",onClick:()=>E(p),className:"w-full text-left px-4 py-3 hover:bg-[#F0F2F8] transition-colors flex items-start gap-3 group",children:[e.jsx(ht,{className:"w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0 group-hover:text-[#5B4FD8] transition-colors"}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] font-semibold leading-tight truncate",children:p.name}),p.address?e.jsxs("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 mt-0.5",children:[p.address," · IČO: ",p.ico]}):null]})]},`${p.ico}-${u}`))})})})]}),e.jsx("input",{type:"text",inputMode:"numeric",value:t.ico,onChange:p=>D(p.target.value),placeholder:"IČO školy",maxLength:10,className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"})]},"school-section")}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1",children:"Kontaktní údaje"}),e.jsx("input",{type:"text",required:!0,value:t.name,onChange:p=>x("name",p.target.value),placeholder:"Jméno a příjmení *",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("input",{type:"email",required:!0,value:t.email,onChange:p=>x("email",p.target.value),placeholder:"Váš e-mail *",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("input",{type:"tel",value:t.phone,onChange:p=>x("phone",p.target.value),placeholder:"Telefon",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsxs("div",{className:"relative",children:[e.jsxs("select",{required:!0,value:t.position,onChange:p=>x("position",p.target.value),className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all appearance-none cursor-pointer",style:{color:t.position?"#001161":"rgba(0,17,97,0.4)"},children:[e.jsx("option",{value:"",disabled:!0,children:"Vaše pozice *"}),d.map(p=>e.jsx("option",{value:p,children:p},p))]}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/40",children:e.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 9l-7 7-7-7"})})})]}),e.jsxs("label",{className:"flex items-start gap-3 cursor-pointer mt-1",children:[e.jsx("div",{className:`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${t.gdpr?"bg-[#5B4FD8] border-[#5B4FD8]":"bg-white border-[#001161]/20"}`,onClick:()=>x("gdpr",!t.gdpr),children:t.gdpr?e.jsx("svg",{className:"w-3 h-3 text-white",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:3,d:"M5 13l4 4L19 7"})}):null}),e.jsxs("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 leading-snug",onClick:()=>x("gdpr",!t.gdpr),children:["Souhlasím se zpracováním osobních údajů podle ",e.jsx("a",{href:"https://www.vividbooks.cz/gdpr",target:"_blank",rel:"noopener noreferrer",className:"underline text-[#5B4FD8] hover:opacity-75",onClick:p=>p.stopPropagation(),children:"Zásad ochrany osobních údajů"}),". *"]})]}),e.jsxs("label",{className:"flex items-start gap-3 cursor-pointer bg-[#FFF7ED] rounded-xl px-4 py-3 border border-[#E8942A]/20",children:[e.jsxs("span",{className:"relative flex-shrink-0 mt-0.5",children:[e.jsx("input",{type:"checkbox",checked:t.newsletter,onChange:()=>x("newsletter",!t.newsletter),className:"sr-only peer"}),e.jsx("span",{className:"block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors"}),e.jsx("span",{className:"absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]"})]}),e.jsxs("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/80 leading-[1.5]",children:[e.jsx("span",{className:"font-bold text-[#001161]",children:"📚 Chci dostávat novinky a tipy do výuky"}),e.jsx("br",{}),"Novinky, tipy do výuky a akce — posíláme je jen tehdy, když stojí za přečtení. Bez spamu."]})]}),y?e.jsxs("div",{className:"flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3",children:[e.jsx(mt,{className:"w-4 h-4 text-red-500 shrink-0"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-red-600 text-[13px]",children:y})]}):null,e.jsx("button",{type:"submit",disabled:F,className:"w-full bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[16px] py-4 rounded-[14px] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,140,0,0.35)]",children:F?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"}),"Odesílám..."]}):f}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 text-center",children:"* Povinné pole"})]})}function ws(t){try{return decodeURIComponent(t)}catch{return t}}const js=["Učitel/ka na ZŠ","Učitel/ka na SŠ","Učitel/ka na VOŠ nebo VŠ","Ředitel/ka školy","Výchovný/á poradce/poradkyně","Pedagogický pracovník/ce","Rodič","Jiné"],ct="uses_vividbooks";function Re(t){return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}function ks(t,s){if(!s?.length)return null;const o=Re(String(t.slug||t.id||"")),x=Re(String(t.title||"")),l=s.find(E=>Re(String(E.slug||E.id||""))===o);return l||(s.find(E=>{const D=Re(String(E.name||E.title||""));return x.length>5&&(D.includes(x.slice(0,Math.floor(x.length*.7)))||x.includes(D.slice(0,Math.floor(D.length*.7))))})??null)}function Ns({webinar:t}){const s=Nt(),o=St(),[x]=Ct(),l=x.get("dotaznik"),j=x.get("dvppDotaznik"),{webinars:E}=dt(),{videos:D,loading:L}=zt(),k=n.useMemo(()=>ks(t,D),[t,D]);t.surveyRequireFullRegistration;const N=n.useMemo(()=>{if(typeof t.surveyRequireFullRegistration=="boolean")return t.surveyRequireFullRegistration;const a=k?.surveyRequireFullRegistration;return typeof a=="boolean"?a:!1},[t.surveyRequireFullRegistration,k]),c=n.useMemo(()=>ut(t),[t]),C=n.useMemo(()=>xt(t),[t]),y=n.useMemo(()=>C.some(a=>a.id===ct),[C]),[F,d]=n.useState({}),f=n.useCallback(a=>{d(a)},[]),p=n.useMemo(()=>j==="1"&&c.length>0&&t.isPast,[j,c.length,t.isPast]),u=n.useMemo(()=>C.length===0||!y?!0:F[ct]==="no",[C.length,y,F]),[i,I]=n.useState({name:"",email:"",phone:"",position:"",gdpr:!1,newsletter:!1,schoolName:"",ico:"",birthDateIso:""}),[m,b]=n.useState(!1),[J,W]=n.useState(!1),[Z,G]=n.useState(!1),[T,S]=n.useState(!1),[z,g]=n.useState(()=>typeof window<"u"?Ve():[]);n.useEffect(()=>{S(!1)},[t.id]),n.useEffect(()=>{!p||T||g(Ve())},[p,T,t.id]);const[v,_]=n.useState(!1),[R,h]=n.useState(""),[$,A]=n.useState(!1),[H,q]=n.useState(null),[te,K]=n.useState([]),[re,O]=n.useState(!1),[le,me]=n.useState(!1),de=n.useRef(null),he=n.useRef(null);n.useEffect(()=>{const a=w=>{de.current&&!de.current.contains(w.target)&&O(!1)};return document.addEventListener("mousedown",a),()=>document.removeEventListener("mousedown",a)},[]),n.useLayoutEffect(()=>{if(!t.isPast||l!=="1"||c.length===0)return;const a=new URLSearchParams(x);if(a.delete("dotaznik"),a.get("prehled")==="1"){s(`${o.pathname}?${a.toString()}`,{replace:!0});return}a.set("dvppDotaznik","1"),s(`${o.pathname}?${a.toString()}`,{replace:!0})},[t.isPast,t.id,l,c.length,x,s,o.pathname]),n.useLayoutEffect(()=>{if(!t.isPast||c.length===0)return;const a=new URLSearchParams(x);a.get("dvppDotaznik")==="1"||a.get("prehled")==="1"||(a.set("dvppDotaznik","1"),s(`${o.pathname}?${a.toString()}`,{replace:!0}))},[t.isPast,t.id,c.length,x,s,o.pathname]),n.useEffect(()=>{if(typeof window>"u")return;const a=new URLSearchParams(window.location.search),w=a.get("email"),B=w?ws(w.trim()):"";if(!B||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(B))return;const xe=a.get("dvppDotaznik")==="1",ve=a.get("dotaznik")==="1";if(xe){if(!t.isPast||c.length===0)return;I(ue=>({...ue,email:B})),_(!0),G(!1),window.history.replaceState({},"",`${window.location.pathname}?dvppDotaznik=1`);return}if(ve){if(t.isPast||C.length===0)return;I(ue=>({...ue,email:B})),W(!0),_(!0),window.history.replaceState({},"",`${window.location.pathname}?dotaznik=1`)}},[t.id,t.isPast,c.length,C.length]),n.useEffect(()=>{if(!v||C.length===0||t.isPast)return;const a=window.setTimeout(()=>{document.getElementById("webinar-dotaznik")?.scrollIntoView({behavior:"smooth",block:"start"})},500);return()=>window.clearTimeout(a)},[v,t.id,C.length,t.isPast]);const Y=async a=>{if(a.trim().length<2){K([]),O(!1);return}me(!0);try{const B=await(await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/school-search?q=${encodeURIComponent(a)}`,{headers:{Authorization:`Bearer ${fe}`}})).json();K(B.results||[]),O((B.results||[]).length>0)}catch{K([])}finally{me(!1)}},ne=a=>{I(w=>({...w,schoolName:a})),he.current&&clearTimeout(he.current),he.current=setTimeout(()=>Y(a),350),h("")},ae=a=>{I(w=>({...w,schoolName:a.name,ico:a.ico})),O(!1),K([])},ye=a=>{I(w=>({...w,ico:a.replace(/\D/g,"").slice(0,10)})),h("")},ge=n.useCallback(a=>{I(w=>({...w,name:a.name,email:a.email,birthDateIso:a.birthDateIso,schoolName:a.schoolName,ico:a.ico})),O(!1),K([]),h("")},[]),we=E.filter(a=>a.id!==t.id&&!a.isPast).slice(0,2),be=new Date(t.year,(t.monthNum||1)-1,t.day||1,...(t.time||"18:00").split(":").map(Number)),De=new Date(be.getTime()+90*6e4),Se=(Date.now()-be.getTime())/6e4,r=!t.isPast&&Se>-30&&Se<150,pe=(typeof localStorage<"u"?localStorage.getItem("vvb_dev_imminent"):null)===t.id&&!t.isPast,Ce=`${typeof window<"u"?window.location.origin:"https://www.vividbooks.com".replace(/\/$/,"")}/webinar/${t.id}/live`,gt=()=>{const a=H?.calendar?.icsBase64;if(!a){He();return}try{const w=atob(a),B=new Uint8Array(w.length);for(let Pe=0;Pe<w.length;Pe++)B[Pe]=w.charCodeAt(Pe);const xe=new Blob([B],{type:"text/calendar;charset=utf-8"}),ve=URL.createObjectURL(xe),ue=document.createElement("a");ue.href=ve,ue.download=`webinar-${t.slug||t.id}.ics`,ue.click(),URL.revokeObjectURL(ve)}catch{He()}},He=()=>{const a=ue=>ue.toISOString().replace(/[-:]|\\.\\d{3}/g,"").slice(0,15)+"Z",w=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Vividbooks//Webinar//CS","BEGIN:VEVENT",`UID:webinar-${t.id}@vividbooks.cz`,`DTSTAMP:${a(new Date)}`,`DTSTART:${a(be)}`,`DTEND:${a(De)}`,`SUMMARY:${t.title}`,`DESCRIPTION:Webinář Vividbooks\\nPřipojte se: ${Ce}`,`URL:${Ce}`,`LOCATION:${Ce}`,"END:VEVENT","END:VCALENDAR"].join(`\r
`),B=new Blob([w],{type:"text/calendar;charset=utf-8"}),xe=URL.createObjectURL(B),ve=document.createElement("a");ve.href=xe,ve.download=`webinar-${t.id}.ics`,ve.click(),URL.revokeObjectURL(xe)},$e=(a,w)=>{I(B=>({...B,[a]:w})),h("")},bt=n.useMemo(()=>{const a=i.ico.replace(/\D/g,"");return i.name.trim().length>0&&i.email.trim().length>0&&/^\d{4}-\d{2}-\d{2}$/.test(i.birthDateIso.trim())&&i.schoolName.trim().length>0&&a.length>=8},[i.name,i.email,i.birthDateIso,i.schoolName,i.ico]),vt=n.useCallback(()=>{A(a=>{const w=!a;return a||(I(B=>({...B,schoolName:"",ico:""})),K([]),O(!1)),w})},[]),yt=async a=>{if(a.preventDefault(),!$&&!i.schoolName.trim()){h("Vyplňte prosím název školy.");return}if(!$&&!i.ico.trim()){h("Vyplňte prosím IČO školy.");return}if(!i.name.trim()||!i.email.trim()||!i.position){h("Vyplňte prosím všechna povinná pole.");return}if(!i.gdpr){h("Souhlas se zpracováním osobních údajů je povinný.");return}if(p&&N){const w=i.email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w)){h("Vyplňte prosím platný e-mail.");return}b(!0),h("");try{if((await(await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/public/webinar-registration-check?webinarId=${encodeURIComponent(String(t.id))}&email=${encodeURIComponent(w)}`,{headers:{Authorization:`Bearer ${fe}`}})).json().catch(()=>({}))).registered){G(!0);return}}catch{h("Nepodařilo se ověřit registraci. Zkuste to prosím znovu.");return}finally{b(!1)}}b(!0),h("");try{const w=await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/webinar-registrace`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:t.id,webinarTitle:t.title,webinarSlug:t.slug||t.id,webinarDay:t.day,webinarMonthNum:t.monthNum,webinarYear:t.year,webinarTime:t.time,webinarMonthName:t.monthName,mailchimpTagName:t.mailchimpTagName,notTeacher:$,...i})});if(!w.ok){const xe=await w.json().catch(()=>({}));if(w.status===409&&p){G(!0),b(!1);return}throw new Error(xe.error||"Registrace se nepodařila.")}const B=await w.json().catch(()=>({}));typeof B.streamUrl=="string"&&B.streamUrl?q({streamUrl:B.streamUrl,calendar:B.calendar&&typeof B.calendar.googleUrl=="string"&&typeof B.calendar.outlookUrl=="string"?{googleUrl:B.calendar.googleUrl,outlookUrl:B.calendar.outlookUrl,icsBase64:typeof B.calendar.icsBase64=="string"&&B.calendar.icsBase64?B.calendar.icsBase64:null}:null}):q(null),p?G(!0):W(!0)}catch(w){console.error("Webinar registration error:",w),h(w.message||"Nastala chyba při odesílání. Zkuste to prosím znovu.")}finally{b(!1)}};return p?T?e.jsxs(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.3},className:"flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#E8EBF4]",children:[e.jsx(Le,{title:`${t.title} — dotazník`,path:`/webinar/${t.id}`,description:`Dotazník po webináři: ${t.title}`,jsonLd:Te({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Oe(`/webinar/${t.id}`)})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-hidden",children:e.jsx(Ue,{webinar:t,email:i.email,participantName:i.name,participantBirthDateIso:i.birthDateIso,participantSchoolName:i.schoolName,participantSchoolIco:i.ico.replace(/\D/g,""),onAnswersChange:f,scope:"post",variant:"fullscreen"})})]}):e.jsxs(U.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.3},className:"flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#E8EBF4]",children:[e.jsx(Le,{title:`${t.title} — dotazník`,path:`/webinar/${t.id}`,description:`Dotazník po webináři: ${t.title}`,jsonLd:Te({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Oe(`/webinar/${t.id}`)})}),e.jsxs("div",{className:"mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 px-4 py-10 sm:px-6",children:[e.jsx("h1",{className:"text-center font-['Cooper_Light',serif] text-[26px] text-[#001161] sm:text-[30px]",children:"Dotazník po webináři"}),e.jsx("p",{className:"text-center font-['Fenomen_Sans',sans-serif] text-[14px] leading-relaxed text-[#001161]/75",children:"Vyplňte údaje pro uložení odpovědí a certifikát. Poté pokračujte k dotazníku — bez přihlášení."}),e.jsxs("div",{className:"rounded-[28px] border border-[#001161]/10 bg-[#F0F2F8] px-5 py-8 md:px-10",children:[e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"Jméno a příjmení *"}),e.jsx("input",{type:"text",value:i.name,onChange:a=>$e("name",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",placeholder:"Jana Nováková",autoComplete:"name",autoFocus:!0}),e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"E-mail *"}),e.jsx("input",{type:"text",inputMode:"email",autoCapitalize:"none",autoCorrect:"off",spellCheck:!1,value:i.email,onChange:a=>$e("email",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",placeholder:"vas@email.cz",autoComplete:"email"}),e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"Datum narození *"}),e.jsx("input",{type:"date",value:i.birthDateIso,onChange:a=>$e("birthDateIso",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("p",{className:"mb-2 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-wider text-[#001161]/40",children:"Škola (vyhledávání) *"}),e.jsxs("div",{ref:de,className:"relative mb-3",children:[e.jsx("input",{type:"text",value:i.schoolName,onChange:a=>ne(a.target.value),onFocus:()=>te.length>0&&O(!0),placeholder:"Název školy",autoComplete:"off",className:"w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30",children:le?e.jsx(ce,{className:"h-4 w-4 animate-spin"}):e.jsx(ft,{className:"h-4 w-4"})}),e.jsx(ke,{children:re&&te.length>0&&e.jsx(U.div,{initial:{opacity:0,y:-6},animate:{opacity:1,y:0},exit:{opacity:0,y:-6},transition:{duration:.15},className:"absolute z-[100] mt-1 max-h-[220px] w-full overflow-y-auto rounded-2xl border border-[#001161]/10 bg-white py-1 shadow-xl",children:te.map((a,w)=>e.jsxs("button",{type:"button",onClick:()=>ae(a),className:"group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0F2F8]",children:[e.jsx(ht,{className:"mt-0.5 h-4 w-4 shrink-0 text-[#001161]/30 transition-colors group-hover:text-[#5B4FD8]"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold leading-tight text-[#001161]",children:a.name}),a.address?e.jsxs("p",{className:"mt-0.5 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40",children:[a.address," · IČO: ",a.ico]}):null]})]},`${a.ico}-${w}`))})})]}),e.jsx("input",{type:"text",inputMode:"numeric",value:i.ico,onChange:a=>ye(a.target.value),placeholder:"IČO školy",maxLength:10,className:"mb-5 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("button",{type:"button",disabled:!bt,onClick:()=>{Gt({name:i.name,email:i.email,birthDateIso:i.birthDateIso,schoolName:i.schoolName,ico:i.ico}),g(Ve()),S(!0)},className:"w-full rounded-[14px] bg-[#001161] py-3.5 font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-white shadow-md transition hover:bg-[#001a8c] disabled:cursor-not-allowed disabled:opacity-50",children:"Pokračovat k dotazníku"})]}),z.length>0&&e.jsxs("div",{className:"mt-1 w-full rounded-[20px] border border-[#001161]/10 bg-white/90 px-4 py-3 shadow-sm",children:[e.jsx("p",{className:"mb-2 font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161]/70",children:"Uložené identity:"}),e.jsx("div",{className:"flex flex-wrap gap-2",children:z.map((a,w)=>e.jsx("button",{type:"button",onClick:()=>ge(a),title:`${a.email}
${a.schoolName}${a.ico?` · IČO ${a.ico}`:""}`,className:"inline-flex max-w-full items-center rounded-full border border-[#001161]/15 bg-[#f8f9fc] px-3.5 py-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] transition-colors hover:border-[#5b4fd8]/45 hover:bg-[#fafaff]",children:a.name.trim()||a.email},`${a.savedAt}-${w}`))})]})]})]}):e.jsxs(U.div,{initial:{opacity:0,y:18},animate:{opacity:1,y:0},transition:{duration:.35},className:"min-h-screen bg-white",children:[e.jsx(Le,{title:t.title,path:`/webinar/${t.id}`,description:`DVPP webinář: ${t.title} — ${t.day}. ${t.monthName} ${t.year} v ${t.time}. Online seminář pro učitele zdarma s certifikátem.`,jsonLd:Te({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Oe(`/webinar/${t.id}`)})}),e.jsx("div",{className:"relative z-30 border-b border-[#001161]/6 bg-white md:sticky md:top-14 md:bg-white/90 md:backdrop-blur-md",children:e.jsxs("div",{className:"max-w-[900px] mx-auto px-6 h-14 flex items-center gap-2",children:[e.jsxs("button",{onClick:()=>s("/webinare"),className:"flex items-center gap-1.5 text-[#001161]/60 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors cursor-pointer group",children:[e.jsx(Fe,{className:"w-4 h-4 group-hover:-translate-x-0.5 transition-transform"}),"Webináře"]}),e.jsx("span",{className:"text-[#001161]/20 text-[13px]",children:"/"}),e.jsx("span",{className:"text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold truncate max-w-[300px]",children:t.title})]})}),e.jsxs("div",{className:"max-w-[900px] mx-auto px-6 py-10",children:[r&&e.jsxs(U.div,{initial:{opacity:0,y:-10},animate:{opacity:1,y:0},className:"mb-6 flex items-center justify-between gap-4 bg-red-600 rounded-2xl px-6 py-4 shadow-lg shadow-red-600/20",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"flex items-center justify-center w-8 h-8 rounded-full bg-white/20",children:e.jsx(Be,{className:"w-4 h-4 text-white animate-pulse"})}),e.jsxs("div",{children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] font-bold text-white text-[15px] leading-tight",children:Se>=0?"Webinář právě probíhá!":`Začínáme za ${Math.abs(Math.round(Se))} min`}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-white/70 text-[12px]",children:"Vstupte na živé vysílání a potvrdte svou účast."})]})]}),e.jsx("a",{href:`/webinar/${t.id}/live`,className:"shrink-0 bg-white hover:bg-gray-100 text-red-600 font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-2.5 rounded-full transition-all hover:scale-105 no-underline",children:"Vstoupit na stream →"})]}),e.jsx("div",{className:"flex justify-center mb-10",children:e.jsxs("div",{className:"bg-[#F0F2F8] rounded-[24px] overflow-hidden w-full max-w-[600px]",children:[e.jsx($t,{title:t.title,subtitle:t.subtitle,day:t.day,monthName:t.monthName,time:t.time,lecturer:t.lecturer,lecturerAvatar:t.lecturerAvatar,variant:t.thumbnailVariant,coverImage:t.coverImage}),e.jsxs("div",{className:"px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4",children:[e.jsxs("div",{className:"flex flex-col items-center bg-white rounded-[14px] px-4 py-2.5 min-w-[56px] shrink-0",children:[e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] font-black text-[#001158] text-[26px] leading-none",children:t.day}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001158]/60 leading-tight",children:t.monthName}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] font-bold text-[13px] leading-none mt-0.5",style:{color:"#FF8C00"},children:t.time})]}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h1",{className:"font-['Cooper_Light',serif] text-[#001161] text-[24px] md:text-[30px] leading-tight mb-2",children:t.title}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("span",{className:"bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10",children:["Lektoři: ",t.lecturer]}),t.targetAudience&&e.jsx("span",{className:"bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10",children:t.targetAudience})]})]}),!t.isPast&&e.jsxs("div",{className:"shrink-0 flex items-center gap-2",children:[e.jsx("a",{href:"#registrace",className:"bg-[#FF8C00] hover:bg-[#e67d00] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer no-underline shadow-[0_4px_16px_rgba(255,140,0,0.35)]",children:"Přihlásit se"}),(pe||r)&&e.jsxs("button",{onClick:()=>s(`/webinar/${t.id}/live`),className:"flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/85 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(0,17,97,0.25)]",children:[e.jsx(Be,{className:"w-3.5 h-3.5"}),"Otevřít webinář"]})]})]})]})}),e.jsxs("div",{className:"mb-8 max-w-[680px]",children:[e.jsx("div",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] leading-[1.7] font-semibold mb-5 webinar-richtext",dangerouslySetInnerHTML:{__html:t.description}}),t.perks&&e.jsx("div",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[15px] leading-relaxed webinar-richtext",dangerouslySetInnerHTML:{__html:t.perks}})]}),t.isPast&&c.length>0&&j!=="1"&&e.jsxs("div",{className:"mb-10 max-w-[560px] mx-auto",children:[e.jsxs("div",{className:"mb-5 rounded-2xl border border-[#001161]/10 bg-[#F8FAFC] px-5 py-4",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] mb-2",children:"E-mail pro odeslání odpovědí"}),e.jsx("input",{type:"text",inputMode:"email",autoCapitalize:"none",autoCorrect:"off",spellCheck:!1,value:i.email,onChange:a=>I(w=>({...w,email:a.target.value})),className:"w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 font-['Fenomen_Sans',sans-serif]",placeholder:"vas@email.cz",autoComplete:"email"})]}),e.jsx(Ue,{webinar:t,email:i.email,participantName:i.name,onAnswersChange:f,scope:"post"})]}),!t.isPast&&e.jsx("div",{id:"registrace",className:"max-w-[560px] mx-auto",children:e.jsxs("div",{className:"bg-[#F0F2F8] rounded-[28px] px-6 md:px-10 py-8",children:[e.jsx("h2",{className:"font-['Cooper_Light',serif] text-[#001161] text-[28px] text-center mb-6",children:"Přihlaste se na webinář"}),J?e.jsxs(U.div,{initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},className:"flex flex-col items-center text-center py-6 gap-4",children:[e.jsx(pt,{className:"w-14 h-14 text-[#27ae60]"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] font-bold",children:"Děkujeme za vaši registraci"}),e.jsxs("p",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[14px] max-w-[360px]",children:[t.day,". ",t.monthName,". ",t.year," v ",t.time," — těšíme se na vaši účast!"]}),e.jsxs("a",{href:H?.streamUrl||Ce,className:r?"w-full flex items-center justify-between gap-3 bg-red-600 hover:bg-red-700 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-red-600/20":"w-full flex items-center justify-between gap-3 bg-[#001161] hover:bg-[#001161]/90 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-[#001161]/25",children:[e.jsxs("span",{className:"flex items-center gap-2 text-left",children:[e.jsx(Be,{className:`w-4 h-4 shrink-0 ${r?"animate-pulse":""}`}),r?"Sledovat webinář live":"Odkaz na živý přenos (v den akce)"]}),e.jsx("span",{className:"text-white/70 text-[12px] font-normal truncate max-w-[160px]",children:(H?.streamUrl||Ce).replace(/^https?:\/\//,"")})]}),r?null:e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 max-w-[360px] -mt-2",children:"živý přenos běží až v naplánovaný čas — odkaz si uložte nebo přidejte událost do kalendáře níže."}),e.jsxs("button",{type:"button",onClick:gt,className:"w-full flex items-center justify-center gap-2.5 bg-white border border-[#001161]/12 hover:border-[#001161]/25 hover:bg-[#f0f2f8] text-[#001161] font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all",children:[e.jsx(Ht,{className:"w-5 h-5 shrink-0 text-[#001161]/80"}),"Přidat do kalendáře"]}),e.jsx(Ue,{webinar:t,email:i.email,participantName:i.name,onAnswersChange:f,scope:"pre"}),u&&!v?e.jsx(Yt,{form:{name:i.name,email:i.email,phone:i.phone,position:i.position,gdpr:i.gdpr,newsletter:i.newsletter,schoolName:i.schoolName,ico:i.ico},notTeacher:$}):null]}):e.jsx(ys,{form:i,notTeacher:$,onTogglePedagogMode:vt,handleChange:$e,handleSubmit:yt,handleSchoolNameChange:ne,handleSchoolSelect:ae,handleIcoChange:ye,schoolContainerRef:de,schoolResults:te,schoolOpen:re,setSchoolOpen:O,schoolSearching:le,error:R,submitting:m,positions:js})]})}),we.length>0&&e.jsxs("div",{className:"mt-16 pb-12",children:[e.jsx("h2",{className:"font-['Cooper_Light',serif] text-[#001161] text-[30px] text-center mb-8",children:"Další nadcházející webináře"}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[700px] mx-auto",children:we.map(a=>e.jsx(Pt,{webinar:a},a.id))})]})]})]})}function nn(){const{id:t}=Ft(),{webinars:s,loading:o}=dt();if(o)return e.jsxs("div",{className:"flex items-center justify-center gap-3 py-32 text-[#001161]/40",children:[e.jsx(ce,{className:"w-5 h-5 animate-spin"}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[14px]",children:"Načítám..."})]});const x=s.find(l=>l.id===t||l.slug===t);return x?e.jsx(Ns,{webinar:x}):e.jsx(Dt,{to:"/webinare",replace:!0})}export{nn as WebinarDetailRoute};
