import{f as yt,r as n,p as je,b as fe,j as e,Z as wt,m as W,a7 as jt,t as Ae,_ as kt,A as ke,aw as Nt,W as St,e as zt,h as Ft,l as ct,o as Ct,i as Ie,k as Dt,N as $t}from"./index-E_S9gpfz.js";import{a as Pt,W as Et}from"./WebinarCard-CnahwK49.js";import{S as Be,w as Le}from"./SEOHead-C5q4mxA8.js";import{m as Ve}from"./marketingSite-D7o8DoEY.js";import{a as _t,S as Rt,s as At}from"./TrialPage-CV2IsGXV.js";import{i as He,a as Qe}from"./emailValidation-zWHvJ6yV.js";import{C as dt}from"./circle-check-big-_gXFlq7G.js";import{E as It}from"./external-link-C7VI0Re6.js";import{C as Bt}from"./clock-a_N94ykg.js";import{L as pe}from"./loader-circle-BgEW_Rjb.js";import{C as pt}from"./circle-alert-_mfWx2CP.js";import{g as mt,a as xt,w as Lt,b as Vt,c as Tt}from"./webinarSurveyDefaults-4Jc6LAJj.js";import{l as Ot}from"./svg-fupfguvmdt-BJftoE9y.js";import{A as Mt}from"./award-DZNUO0ej.js";import{D as Ut}from"./download-gFHVSYRU.js";import{C as Ce}from"./chevron-left-CKgpxm_W.js";import{C as Re}from"./chevron-right-CoBGKZLf.js";import{C as Wt}from"./clipboard-list-UW0xswv8.js";import{C as Gt}from"./check-X_OLuRpM.js";import{S as ut}from"./search-ChBcdTPl.js";import{B as ft}from"./building-2-vOceAW_y.js";import{l as Te,r as Ht}from"./dvppSavedContacts-B9FJeLoK.js";import{C as Qt}from"./calendar-DJ-uPu5E.js";import"./publicSiteUrl-DPRQtDgz.js";import"./ImageWithFallback-DJ42hkAM.js";import"./play-DqTXdmtC.js";import"./user-FGaiNq8P.js";import"./message-circle-B3UnlL1U.js";import"./mail-BaRRPzvO.js";import"./phone-DiH59Rf5.js";import"./users-ChgBPXku.js";import"./sparkles-CG2IZL9T.js";import"./book-open-DZJyUgIQ.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zt=[["path",{d:"M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21",key:"9csbqa"}],["path",{d:"m14 19 3 3v-5.5",key:"9ldu5r"}],["path",{d:"m17 22 3-3",key:"1nkfve"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}]],Ze=yt("image-down",Zt),Oe=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,Q={fontFamily:"'Fenomen Sans', sans-serif"};function Jt(t){return/Učitel|Pedagogický/i.test(t)}function Yt(t){return{name:t.name.trim(),email:t.email.trim(),phone:t.phone.trim(),position:t.position,schoolName:t.schoolName.trim(),vat:t.ico.replace(/\D/g,"").slice(0,10),gdpr:t.gdpr,newsletter:t.newsletter,teacherSubjects:Jt(t.position)?["Other-2"]:[],schoolStages:[]}}function Kt({form:t,notTeacher:s}){const[o,m]=n.useState(null),[l,S]=n.useState(""),[j,D]=n.useState(!1),[B,T]=n.useState([]),[h,p]=n.useState(null),[z,w]=n.useState([]),[L,c]=n.useState(!1),[k,x]=n.useState(null),[d,r]=n.useState(null),[F,u]=n.useState(!1),[v,H]=n.useState(null),[V,Z]=n.useState(!1),[O,I]=n.useState(""),N=t.ico.replace(/\D/g,"").slice(0,10),C=(o==="active_subscription"||o==="active_trial"||o==="in_progress")&&!!l&&!j,g=L&&!j&&!C&&o!=="unknown"&&o!=="invalid"&&o!==null&&N.length>=6,b=n.useMemo(()=>{if(!k)return null;const P=new Date(k);return Number.isNaN(P.getTime())?null:{dateStr:P.toLocaleDateString("cs-CZ",{day:"numeric",month:"long",year:"numeric"}),daysLeft:Math.max(0,Math.ceil((P.getTime()-Date.now())/(1e3*60*60*24)))}},[k]),$=n.useRef(null);n.useEffect(()=>{if(s||N.length<6){m(null),S(""),T([]),p(null),w([]),c(!1),x(null);return}$.current&&clearTimeout($.current),$.current=setTimeout(async()=>{D(!0);try{const E=await(await fetch(`${Oe}/school-pipedrive-check?ico=${encodeURIComponent(N)}`,{headers:{Authorization:`Bearer ${fe}`}})).json();m(E.status||"unknown"),S(typeof E.message=="string"?E.message:""),T(Array.isArray(E.colleagues)?E.colleagues:[]),p(E.owner??null),w(Array.isArray(E.products)?E.products:[]),c(!!E.trialCooldownActive),x(typeof E.trialNextEligibleAt=="string"?E.trialNextEligibleAt:null)}catch{m("unknown"),S(""),T([]),p(null),w([]),c(!1),x(null)}finally{D(!1)}},600)},[N,s]);const R=n.useRef(null);n.useEffect(()=>{const P=t.email.trim();if(s||!P||!He(P)){r(null);return}R.current&&clearTimeout(R.current),R.current=setTimeout(async()=>{u(!0);try{const E=await fetch(`${Oe}/check-trial-email?email=${encodeURIComponent(P)}`,{headers:{Authorization:`Bearer ${fe}`}});r(await E.json())}catch{r(null)}finally{u(!1)}},400)},[t.email,s]);const f=async()=>{if(!(C||g)){if(!t.gdpr){I("Chybí souhlas se zpracováním údajů z registrace.");return}if(d?.emailInvalid&&d.message){I(d.message);return}if(d&&!d.canRequest&&!d.emailInvalid){I(`S tímto e-mailem byl trial již požádán. Další žádost můžete podat od ${d.cooldownDateStr}.`);return}if(!He(t.email.trim())){I(Qe);return}Z(!0),I("");try{const E=await(await fetch(`${Oe}/validate-email?email=${encodeURIComponent(t.email.trim())}`,{headers:{Authorization:`Bearer ${fe}`}})).json();if(!E.ok){I(typeof E.message=="string"?E.message:Qe);return}const G=Yt(t),ee=await At(G);if(ee.status==="error"){I(ee.message);return}H(ee)}catch(P){I(P instanceof Error?P.message:"Odeslání se nezdařilo.")}finally{Z(!1)}}};return s?e.jsxs("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:[e.jsx("p",{style:Q,className:"text-[14px] font-bold text-[#001161] mb-2",children:"Zkusit Vividbooks zdarma"}),e.jsx("p",{style:Q,className:"text-[13px] text-[#001161]/65 leading-relaxed mb-4",children:"Pro 14denní přístup potřebujeme název školy a IČO. Vyplněte prosím zkušební formulář."}),e.jsx(wt,{to:"/vyzkousejte",className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 font-bold text-[14px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline",style:Q,children:"Přejít na zkušební přístup"})]}):v?.status==="codes"?e.jsx(W.div,{initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:e.jsxs("div",{className:"rounded-[20px] border border-green-200 bg-[#F0FDF4] p-6",children:[e.jsx(dt,{className:"mx-auto mb-3 h-10 w-10 text-green-500"}),e.jsx("h3",{className:"mb-2 text-center font-['Cooper_Light',serif] text-[22px] text-[#001161]",children:"Zkušební přístup"}),e.jsx("p",{style:Q,className:"mb-5 text-center text-[13px] text-[#001161]/70 leading-snug",children:v.kind==="existing_trial"?"Vaše škola už má aktivní zkušební přístup. Pro přihlášení použijte tyto kódy:":"Vaše přístupové kódy pro zkušební verzi:"}),e.jsxs("div",{className:"mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{className:"rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm",children:[e.jsx("p",{style:Q,className:"mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45",children:"Kód pro učitele"}),e.jsx("p",{style:Q,className:"font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all",children:v.teacherCode})]}),e.jsxs("div",{className:"rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm",children:[e.jsx("p",{style:Q,className:"mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45",children:"Kód pro žáka"}),e.jsx("p",{style:Q,className:"font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all",children:v.studentCode})]})]}),e.jsxs("a",{href:jt(),target:"_blank",rel:"noopener noreferrer",className:"mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline",style:Q,children:[e.jsx(It,{className:"h-4 w-4 shrink-0","aria-hidden":!0}),"Otevřít aplikaci"]}),e.jsx(_t,{compact:!0,sectionClassName:"mt-5 border-t border-green-200/70 pt-5"})]})}):v?.status==="thank_only"?e.jsx("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left",children:e.jsx("p",{style:Q,className:"text-[14px] text-[#001161]/75 leading-relaxed",children:"Děkujeme za žádost. Ozveme se vám co nejdříve s přístupovými údaji na e-mail."})}):e.jsxs("div",{className:"w-full mt-6 pt-6 border-t border-[#001161]/10 text-left space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{style:Q,className:"text-[16px] font-bold text-[#001161] mb-1",children:"Vyzkoušejte Vividbooks"}),e.jsx("p",{style:Q,className:"text-[13px] text-[#001161]/60 leading-relaxed",children:C?"Máte přístup do Vividbooks? Ve vaší škole už digitální učebnice využívají kolegové. Kontakt a případné kódy najdete níže.":g?"Vaše škola nedávno žádala o zkušební přístup. Možnosti máte níže.":"Máte zájem o 14denní přístup k digitálním učebnicím? Stačí jeden klik — stejně jako u zkušebního formuláře vám přijde potvrzení a přístupové kódy."})]}),e.jsx(Rt,{readOnly:!0,schoolName:t.schoolName,ico:N,onSelect:()=>{},onIcoChange:()=>{},pdStatus:o,pdMessage:l,pdLoading:j,colleagues:B,owner:h,products:z,hidePipedriveStatusCard:g}),g&&e.jsxs(W.div,{initial:{opacity:0,y:-4},animate:{opacity:1,y:0},className:"overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/90",children:[e.jsxs("div",{className:"flex items-center gap-2.5 px-4 pt-4 pb-2",children:[e.jsx(Bt,{className:"h-4 w-4 shrink-0 text-amber-600","aria-hidden":!0}),e.jsx("p",{style:Q,className:"text-[14px] font-bold text-amber-900",children:"Tato škola dostala přístup nedávno"})]}),e.jsx("div",{className:"space-y-3 px-4 pb-4",children:e.jsxs("div",{className:"space-y-2.5 rounded-xl border border-amber-200/80 bg-white/70 px-3.5 py-3",children:[e.jsx("p",{style:Q,className:"m-0 text-[13px] text-[#001161]/80 leading-relaxed",children:"Zkušební přístupy vydáváme každé škole jednou za šest měsíců."}),b&&e.jsxs("p",{style:Q,className:"m-0 text-[12px] text-amber-900",children:["Další žádost z formuláře bude možná od ",e.jsx("span",{className:"font-bold",children:b.dateStr}),b.daysLeft>0?e.jsxs(e.Fragment,{children:[" (","za ",e.jsx("span",{className:"font-semibold text-[#001161]",children:b.daysLeft})," dní)."]}):"."]}),e.jsxs("p",{style:Q,className:"m-0 text-[12px] text-[#001161]/70",children:["Potřebujete dřív? Napište na ",e.jsx("a",{href:"mailto:hello@vividbooks.com",className:"font-bold text-amber-900 underline underline-offset-2",children:"hello@vividbooks.com"}),h?.name?` (${h.name})`:"","."]})]})})]}),!C&&!g&&e.jsxs("div",{className:"space-y-2",children:[e.jsx("button",{type:"button",onClick:f,disabled:V||!t.gdpr||!!d&&!d.canRequest,className:"flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50",style:Q,children:V?e.jsxs(e.Fragment,{children:[e.jsx(pe,{className:"h-4 w-4 animate-spin"}),"Odesílám…"]}):"Chci přístup"}),e.jsxs("div",{className:"flex items-center justify-center gap-2 min-h-[20px]",children:[F&&e.jsx(pe,{className:"h-3.5 w-3.5 animate-spin text-[#001161]/35"}),d?.emailInvalid&&d.message&&e.jsx("p",{style:Q,className:"text-[12px] text-red-700 text-center",children:d.message}),d&&!d.canRequest&&!d.emailInvalid&&e.jsxs("p",{style:Q,className:"text-[12px] text-amber-800 text-center",children:["S tímto e-mailem byl trial již požádán. Další od ",d.cooldownDateStr,"."]})]})]}),O&&e.jsxs("div",{className:"flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3",children:[e.jsx(pt,{className:"mt-0.5 h-4 w-4 shrink-0 text-red-500"}),e.jsx("p",{style:Q,className:"text-[13px] text-red-700",children:O})]}),e.jsx("p",{style:Q,className:"text-[11px] text-[#001161]/40",children:"Souhlas se zpracováním údajů z registrace na webinář se vztahuje i na tuto žádost o zkušební přístup."})]})}const Xt=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,ie={fontFamily:"'Fenomen Sans', sans-serif"},Je={fontFamily:"'Cooper Light', serif"},qt=4,es=`
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
`,Fe={representativeName:"MgA. Vít Škop",representativeTitle:"statutární zástupce vzdělávacího zařízení",companyName:"Vividbooks s.r.o.",addressLine1:"Nad Královskou oborou 33",addressLine2:"Praha 7, 170 00"};function U(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Ye(t){const s=(t||"").trim();return/^https:\/\//i.test(s)?s:""}const ts={1:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="160" cy="40" r="60" fill="white" opacity="0.15"/><circle cx="120" cy="160" r="50" fill="white" opacity="0.12"/><ellipse cx="130" cy="100" rx="38" ry="38" fill="#F472B6" opacity="0.9"/><ellipse cx="130" cy="72" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="130" cy="128" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="102" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="158" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><circle cx="130" cy="100" r="25" fill="#EC4899" opacity="0.95"/><circle cx="175" cy="165" r="55" fill="white" opacity="0.15"/><circle cx="30" cy="30" r="30" fill="white" opacity="0.08"/></svg>',2:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="70" y="30" width="110" height="32" rx="4" fill="#9B59B6"/><rect x="70" y="68" width="110" height="32" rx="4" fill="#E74C3C"/><rect x="70" y="106" width="110" height="32" rx="4" fill="#E8E8E8"/><rect x="70" y="144" width="110" height="32" rx="4" fill="#2ECC71"/><circle cx="30" cy="50" r="20" fill="white" opacity="0.1"/><circle cx="20" cy="140" r="30" fill="white" opacity="0.08"/></svg>',3:'<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="145" cy="100" r="60" fill="#2ECC71" opacity="0.95"/><path d="M85 100 A60 60 0 0 1 145 40 L145 100 Z" fill="#27AE60" opacity="0.9"/><rect x="105" y="60" width="50" height="50" rx="4" fill="#E74C3C" opacity="0.9"/><rect x="120" y="115" width="35" height="35" rx="4" fill="white" opacity="0.9"/><circle cx="90" cy="150" r="20" fill="#3498DB" opacity="0.9"/><circle cx="165" cy="55" r="10" fill="#3498DB" opacity="0.85"/></svg>'},ss="0 0 1786.62 869.93",ns=["p299c6b00","p3cc4870","p98d9300","pf524b00","p26e2d80","p15998cf0","p1bd3b900","p19a24c00","p34d64300","p396dedf0"];function as(){const t=ns.map(s=>{const o=Ot[s];return`<path d="${U(o)}" fill="#001161"/>`}).join("");return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ss}" fill="none" class="cert-logo-svg" aria-label="Vividbooks" role="img">${t}</svg>`}function os(t){return String(t).padStart(2,"0")}function rs(t){return`dne ${t.day}. ${os(t.monthNum)}. ${t.year} od ${(t.time||"—").replace(":",".")}`}function is(t){const s=t/60,o=Number.isInteger(s)?String(s):String(Math.round(s*10)/10).replace(".",",");return s===1?`${o} hodina`:s>1&&s<5?`${o} hodiny`:`${o} hodin`}function Ke(t){const s=t.trim().split("-");if(s.length!==3)return"";const o=parseInt(s[0],10),m=parseInt(s[1],10),l=parseInt(s[2],10);return!o||!m||!l?"":`${l}. ${m}. ${o}`}function ls(t){return new Intl.DateTimeFormat("cs-CZ",{day:"numeric",month:"long",year:"numeric"}).format(t)}function Xe(t){const{webinar:s,email:o,participantName:m,birthDateIso:l,kind:S,previewMode:j=!1}=t,D=j?"auto":"186mm",B=j?"10px":"0",T=as(),h=U(s.title),p=U(s.lecturer||""),z=U(`${s.day}. ${s.monthName} ${s.year}, ${s.time}`),w=typeof s.durationMinutes=="number"?s.durationMinutes:120,L=is(w),c=U(m.trim()||o.trim()||"účastník"),k=U(o.trim()),x=l&&Ke(l)?U(Ke(l)):"",d=U(ls(new Date)),r=U(rs(s)),F=S==="dvpp"?"Potvrzení o splnění ověření znalostí z webináře (DVPP)":"Potvrzení o vyplnění dotazníku po webináři",u=S==="dvpp"?"Tímto se potvrzuje, že níže uvedený účastník úspěšně absolvoval ověření znalostí z webináře v rozsahu vzdělávací akce zařazené do systému DVPP. Ověření bylo provedeno vyplněním dotazníku po skončení akce.":"Tímto se potvrzuje vyplnění zpětné vazby po webináři níže uvedeným účastníkem. Doklad slouží pro vaši evidenci; nenahrazuje oficiální certifikát z akreditované dráhy, pokud ho škola vyžaduje samostatně.",v=S==="dvpp"?"Toto potvrzení slouží jako doklad o splnění povinnosti ověření znalostí v rámci účasti na akci (dle pravidel vaší školy a platné legislativy). V případě dotazů kontaktujte organizátora na podpoře Vividbooks.":"Tento doklad potvrzuje účast na zpětné vazbě. Pro oficiální certifikát DVPP použijte odkaz u webináře nebo pokyny od organizátora.",H=U(Fe.representativeName),V=U(Fe.representativeTitle),Z=U(Fe.companyName),O=U(Fe.addressLine1),I=U(Fe.addressLine2),N=`
    <div class="footer-wrap footer-dvpp-full">
      <div class="footer-grid">
        <div class="footer-col">
          <p class="footer-h">Osvědčení o účasti</p>
          <p class="footer-sub">V online vzdělávacím programu:</p>
          <p class="footer-strong">${h}</p>
          <p class="footer-meta">${r}</p>
        </div>
        <div class="footer-col footer-col-wide">
          <p class="footer-p">
            Program proběhl distanční formou, v rozsahu <strong>${U(L)}</strong>.
            Lektorem webináře byl <strong>${p||"—"}</strong>.
            Program byl zakončen dotazníkovým šetřením.
          </p>
        </div>
        <div class="footer-col">
          <p class="footer-p">${H}</p>
          <p class="footer-p">V Praze dne ${d}</p>
          <p class="footer-small">${V}</p>
        </div>
        <div class="footer-col">
          <p class="footer-strong">${Z}</p>
          <p class="footer-p">${O}</p>
          <p class="footer-p">${I}</p>
        </div>
      </div>
    </div>
  `,C=`
    <div class="footer-wrap footer-simple">
      <p class="footer-p"><strong>${Z}</strong>, ${O}, ${I}</p>
      <p class="footer-small">Vydáno elektronicky: ${d} — ${H}, ${V}</p>
    </div>
  `,g=x&&S==="dvpp"?`<div class="birth">Datum narození: <strong>${x}</strong></div>`:"",b=x||"—",$=`sheet${j?" sheet-preview":""}${S==="dvpp"?" sheet-dvpp":" sheet-feedback"}`,R=Ye(s.coverImage),f=Ye(s.lecturerAvatar),P=(s.monthName||"").trim().slice(0,3).toLowerCase(),E=U(`${s.day}. ${P}. ${s.year} od ${(s.time||"—").replace(":",".")}`),G=U((s.subtitle||"").trim()),ee=s.thumbnailVariant===2||s.thumbnailVariant===3?s.thumbnailVariant:1,te=R?`<img class="cert-wt-cover" src="${U(R)}" alt="" />`:ts[ee],Y=f?`<img class="cert-wt-avatar" src="${U(f)}" alt="" />`:"",de=G?`<p class="cert-wt-sub">${G}</p>`:"",se=p?`<p class="cert-wt-lecturer">${p}</p>`:"",he=U((s.monthName||"").trim()),ge=U((s.time||"—").replace(":",".")),K=p?`Lektoři: ${p}`:"",ne=s.relatedSubjects?.[0]||s.tags?.[0],le=ne?U(String(ne)):"",be=K||le?`<div class="cert-wc-pills">${K?`<span class="cert-wc-pill">${K}</span>`:""}${le?`<span class="cert-wc-pill">${le}</span>`:""}</div>`:"",oe=R?`<div class="cert-webinar-thumb cert-webinar-thumb-coveronly"><img class="cert-wt-cover-full" src="${U(R)}" alt="" /></div>`:`<div class="cert-webinar-thumb">
        <div class="cert-wt-yellow">
          <div class="cert-wt-yellow-top">
            ${de}
            <p class="cert-wt-title">${h}</p>
          </div>
          <div class="cert-wt-yellow-bot">
            <p class="cert-wt-meta">DVPP Webinář zdarma</p>
            <p class="cert-wt-meta">${E}</p>
            ${se}
            ${Y}
          </div>
        </div>
        <div class="cert-wt-right">${te}</div>
      </div>`,re=`
  <div class="cert-inner cert-dvpp-frame">
    <div class="cert-dvpp-split">
      <div class="cert-content-col">
        <div class="cert-content-head">
          <div class="cert-logo-img-wrap">
            ${T}
          </div>
          <p class="cert-kicker">Vzdělávání učitelů</p>
          <h1 class="cert-main-title">Certifikát DVPP</h1>
          <p class="cert-subtitle">Ověření znalostí</p>
        </div>
        <div class="cert-participant-wrap">
          <div class="cert-participant">
            <p class="cert-participant-label">Účastník</p>
            <p class="cert-name">${c}</p>
            <p class="cert-dob">Datum narození: <strong>${b}</strong></p>
          </div>
        </div>
      </div>
      <div class="cert-wc-column" aria-hidden="true">
        <div class="cert-wc-card">
          <div class="cert-wc-thumb-wrap">
            ${oe}
          </div>
          <div class="cert-wc-bar">
            <div class="cert-wc-date">
              <span class="cert-wc-day">${s.day}</span>
              <span class="cert-wc-mon">${he}</span>
              <span class="cert-wc-time">${ge}</span>
            </div>
            <div class="cert-wc-bar-main">
              <p class="cert-wc-bar-title">${h}</p>
              ${be}
            </div>
          </div>
        </div>
      </div>
    </div>
    ${N}
  </div>`,X=`
    <div class="brand">Vividbooks — vzdělávání učitelů</div>
    <h1>${F}</h1>
    <div class="meta">
      <strong>Webinář:</strong> ${h}<br/>
      <strong>Datum konání:</strong> ${z}<br/>
      <strong>Lektor:</strong> ${p||"—"}<br/>
      <strong>Odhadovaný rozsah akce:</strong> ${w} min (${U(L)})
    </div>
    <p class="text">${u}</p>
    <div class="participant">
      <div class="label">Účastník</div>
      <div class="name">${c}</div>
      <div class="em">${k}</div>
      ${g}
    </div>
    <p class="text body-note">${v}</p>
    ${C}`;return`<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="only light" />
  <title>${S==="dvpp"?"Certifikát DVPP":F}</title>
  <link rel="preconnect" href="https://iekkundgizzdbmkzatdl.supabase.co" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf" as="font" type="font/otf" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf" as="font" type="font/otf" crossorigin />
  <style>
    ${es}
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    html {
      height: 100%;
      background-color: #ffffff;
      color-scheme: only light;
    }
    body {
      margin: 0;
      padding: ${B};
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
  <div class="${$}">
    ${S==="dvpp"?re:X}
  </div>
</body>
</html>`}function qe({srcDoc:t,className:s="",iframeRef:o}){return e.jsxs("div",{className:`w-full text-left ${s}`,children:[e.jsx("p",{className:"mb-2 text-[11px] font-bold uppercase tracking-wider text-[#001161]/50",children:"Náhled"}),e.jsx("div",{className:"overflow-hidden rounded-xl border border-[#001161]/12 bg-slate-100 shadow-inner",children:e.jsx("iframe",{ref:o,title:"Náhled potvrzení",srcDoc:t,className:"block aspect-[297/210] h-auto w-full border-0 bg-white"})}),e.jsx("p",{style:ie,className:"mt-2 text-center text-[11px] text-[#001161]/45",children:"Stejné zobrazení jako při tisku nebo PDF"})]})}function cs({webinar:t,email:s,participantName:o="",participantBirthDateIso:m="",participantSchoolName:l="",participantSchoolIco:S="",variant:j="default",certificateKind:D}){const B=j==="fullscreen",T=(m||"").trim(),h=(o||"").trim().length>0,p=/^\d{4}-\d{2}-\d{2}$/.test(T),z=D==="dvpp"&&h&&p,w=D==="dvpp",[L,c]=n.useState(()=>w&&!z),[k,x]=n.useState(()=>(o||"").trim()),[d,r]=n.useState(()=>T),[F,u]=n.useState(!1),[v,H]=n.useState(""),[V,Z]=n.useState(!1),O=n.useRef(null),I=n.useMemo(()=>w?/^\d{4}-\d{2}-\d{2}$/.test(d.trim()):!0,[w,d]),N=k.trim().length>0&&I,C=n.useMemo(()=>Xe({webinar:t,email:s,participantName:k.trim()||o,birthDateIso:w?d.trim():void 0,kind:D,previewMode:!0}),[t,s,o,k,d,D,w]),g=n.useCallback(async()=>{const P=O.current?.contentDocument;if(!P){Ae.error("Náhled ještě není připraven — zkuste za chvíli znovu.");return}const E=P.querySelector(".sheet");if(!E){Ae.error("Certifikát v náhledu nebyl nalezen.");return}Z(!0);try{await P.fonts?.ready,await new Promise(de=>{requestAnimationFrame(()=>requestAnimationFrame(()=>de()))});const{toPng:G}=await kt(async()=>{const{toPng:de}=await import("./index-BeoRn2gJ.js");return{toPng:de}},[]),ee=await G(E,{pixelRatio:qt,cacheBust:!0,backgroundColor:"#ffffff"}),te=String(t.slug||t.id||"webinar").replace(/[^a-zA-Z0-9-_]+/g,"-"),Y=document.createElement("a");Y.download=`certifikat-dvpp-${te}.png`,Y.href=ee,Y.rel="noopener",Y.click()}catch(G){console.error("[certificate] PNG export",G),Ae.error(G instanceof Error?G.message:"PNG se nepodařilo vytvořit.")}finally{Z(!1)}},[t.id,t.slug]),b=n.useCallback(()=>{const f=Xe({webinar:t,email:s,participantName:k.trim()||o,birthDateIso:w?d.trim():void 0,kind:D}),P=new Blob([f],{type:"text/html;charset=utf-8"}),E=URL.createObjectURL(P),G=window.open(E,"_blank");if(!G){URL.revokeObjectURL(E);return}let ee=!1;const te=()=>{if(!ee){ee=!0;try{G.focus(),G.print()}catch{}window.setTimeout(()=>{try{URL.revokeObjectURL(E)}catch{}},1500)}};G.addEventListener("load",te,{once:!0}),window.setTimeout(te,600)},[t,s,o,k,d,D,w]),$=n.useCallback(async()=>{if(!w)return!0;H(""),u(!0);try{const f=await fetch(`${Xt}/webinar-dvpp-certificate-profile`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:k.trim(),birthDateIso:d.trim(),schoolName:(l||"").trim(),schoolIco:(S||"").replace(/\D/g,"").slice(0,10)})}),P=await f.json().catch(()=>({}));if(!f.ok)throw new Error(P.error||`HTTP ${f.status}`);return!0}catch(f){return H(f instanceof Error?f.message:"Chyba"),!1}finally{u(!1)}},[w,t.id,s,k,d,l,S]),R=n.useRef(!1);return n.useEffect(()=>{!z||L||R.current||(R.current=!0,$())},[z,L,$]),L&&w?e.jsxs(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.35},className:B?"flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10":"w-full mt-6 border-t border-[#001161]/10 pt-8",children:[e.jsxs("div",{className:B?"w-full max-w-md":"mx-auto w-full max-w-[480px]",children:[e.jsx("h2",{style:Je,className:"text-[18px] font-normal text-[#001161] sm:text-[20px]",children:"Údaje pro certifikát"}),e.jsx("p",{style:ie,className:"mt-2 text-[13px] leading-relaxed text-[#001161]/70",children:"Zkontrolujte jméno a doplňte datum narození. Údaje se uloží pro certifikát (bez nutnosti být registrovaný na webinář). Mailchimp se doplní jen pokud tam už kontakt máte. Propíšou se do tisku a PDF."}),e.jsxs("div",{className:"mt-6 flex flex-col gap-4 text-left",children:[e.jsxs("label",{style:ie,className:"block",children:[e.jsx("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:"Jméno a příjmení"}),e.jsx("input",{type:"text",value:k,onChange:f=>x(f.target.value),className:"w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40",autoComplete:"name"})]}),e.jsxs("label",{style:ie,className:"block",children:[e.jsx("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:"E-mail"}),e.jsx("input",{type:"email",value:s,readOnly:!0,className:"w-full cursor-not-allowed rounded-xl border border-[#001161]/10 bg-slate-50 px-4 py-3 text-[15px] text-[#001161]/70"})]}),e.jsxs("label",{style:ie,className:"block",children:[e.jsxs("span",{className:"mb-1 block text-[12px] font-semibold text-[#001161]/80",children:["Datum narození"," ",e.jsx("span",{className:"text-red-600",children:"*"})]}),e.jsx("input",{type:"date",value:d,onChange:f=>r(f.target.value),className:"w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40",required:!0})]})]})]}),e.jsx(qe,{srcDoc:C,iframeRef:O,className:"mx-auto mt-8 w-full max-w-[min(920px,100%)] px-0"}),e.jsx("div",{className:"mx-auto mt-4 flex w-full max-w-[min(920px,100%)] justify-center px-0",children:e.jsxs("button",{type:"button",onClick:()=>void g(),disabled:V,className:"inline-flex items-center justify-center gap-2 rounded-xl border border-[#001161]/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50",style:ie,children:[e.jsx(Ze,{className:"h-4 w-4 shrink-0"}),V?"Generuji PNG…":"Stáhnout PNG (4× rozlišení)"]})}),e.jsxs("div",{className:B?"w-full max-w-md":"mx-auto w-full max-w-[480px]",children:[v?e.jsx("p",{style:ie,className:"mt-4 text-[12px] text-red-600",children:v}):null,e.jsx("button",{type:"button",disabled:!N||F,onClick:async()=>{await $()&&c(!1)},className:"mt-6 w-full rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40",style:ie,children:F?"Ukládám…":"Pokračovat k potvrzení a PDF"})]})]}):e.jsx(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.35},className:B?"flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10":"w-full mt-6 border-t border-[#001161]/10 pt-8",children:e.jsxs("div",{className:B?"w-full max-w-[min(920px,100%)] text-center":"mx-auto w-full max-w-[min(920px,100%)] text-center",children:[e.jsx("div",{className:"mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#001161]/8",children:e.jsx(Mt,{className:"h-9 w-9 text-[#001161]",strokeWidth:1.5})}),e.jsx("h2",{style:Je,className:"text-[20px] font-normal leading-snug text-[#001161] sm:text-[22px]",children:D==="dvpp"?"Hotovo — máte splněné ověření znalostí (DVPP)":"Děkujeme za vyplnění dotazníku"}),e.jsx("p",{style:ie,className:"mt-3 text-[14px] leading-relaxed text-[#001161]/70",children:D==="dvpp"?"Níže je náhled stejný jako při tisku / PDF. PNG lze stáhnout ve vysokém rozlišení (4×); PDF přes tisk v prohlížeči (Uložit jako PDF).":"Níže je náhled; můžete vytisknout nebo uložit potvrzení o vyplnění zpětné vazby (PNG ve 4× rozlišení nebo PDF přes tisk)."}),e.jsx(qe,{srcDoc:C,iframeRef:O,className:"mx-auto mt-8"}),e.jsxs("div",{className:"mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center",children:[e.jsxs("button",{type:"button",onClick:b,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:scale-[1.02]",style:ie,children:[e.jsx(Ut,{className:"h-4 w-4 shrink-0"}),"Stáhnout PDF (tisk → Uložit jako PDF)"]}),e.jsxs("button",{type:"button",onClick:()=>void g(),disabled:V,className:"inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#001161]/12 bg-white px-6 py-3 text-[14px] font-bold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50",style:ie,children:[e.jsx(Ze,{className:"h-4 w-4 shrink-0"}),V?"Generuji PNG…":"Stáhnout PNG (4× rozlišení)"]})]}),w?e.jsx("button",{type:"button",onClick:()=>c(!0),className:"mt-4 text-[13px] font-semibold text-[#001161]/50 underline-offset-2 hover:text-[#001161]/80 hover:underline",style:ie,children:"Upravit údaje pro certifikát"}):null,e.jsx("p",{style:ie,className:"mt-4 text-[12px] text-[#001161]/45",children:"V Chrome nebo Edge v okně tisku zvolte „Uložit jako PDF“. Obsah potvrzení odpovídá údajům o webináři a údajům v certifikátu."})]})})}const ds="#001161";function Ne({total:t,filled:s,className:o=""}){if(t<=0)return null;const m=Math.max(0,Math.min(s,t));return e.jsx("div",{className:`flex justify-center gap-1 px-2 ${o}`,role:"progressbar","aria-valuenow":m,"aria-valuemin":0,"aria-valuemax":t,children:Array.from({length:t},(l,S)=>e.jsx("div",{className:"h-1.5 min-w-[6px] max-w-[40px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[48px]",style:{backgroundColor:S<m?ds:"rgba(0,17,97,0.12)"}},S))})}const q={fontFamily:"'Fenomen Sans', sans-serif"},et={fontFamily:"'Cooper Light', serif"},ps="#E8EBF4",ce="#001161",tt="#4E5871",st="#7C3AED",nt="#C2DFFF";function ms({webinarTitle:t,questions:s,answers:o,onAnswerChange:m,onComplete:l,variant:S="default",flowProgressTotal:j,flowProgressFilled:D,onStepChange:B,onSavePartialAnswer:T}){const h=S==="fullscreen",p=s.length,[z,w]=n.useState(""),L=n.useRef(0),[c,k]=n.useState(-1),x=n.useRef(c),[d,r]=n.useState(null);n.useEffect(()=>{x.current=c},[c]),n.useEffect(()=>{B?.(c)},[c,B]),n.useEffect(()=>{w(""),r(null)},[c]);const F=c<0?0:Math.min(c+1,p),u=typeof j=="number"&&j>0&&typeof D=="number",v=c>=0&&c<p?s[c]:null,H=v?o[v.id]:void 0,V=n.useCallback((N,C)=>{w(""),r(null);const g=x.current;if(m(N,C),!T)return;const b=++L.current;(async()=>{try{const $=await T(N,C);if(L.current!==b||x.current!==g)return;$&&typeof $=="object"&&$.wrongAnswer?r("wrong"):r("correct")}catch($){if(L.current!==b||x.current!==g)return;w($ instanceof Error?$.message:"Uložení se nezdařilo"),r(null)}})()},[m,T]),Z=n.useCallback(()=>{k(N=>Math.max(-1,N-1))},[]),O=n.useCallback(()=>{if(c===-1){k(0);return}if(c>=0&&c<p){if(!H||z)return;if(c===p-1){l();return}k(N=>N+1)}},[c,p,H,z,l]);if(p===0)return null;const I=["A","B","C","D"];return h?e.jsxs("div",{className:"relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]",style:{backgroundColor:ps},children:[e.jsxs("div",{className:`pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0`,children:[e.jsx("button",{type:"button",onClick:Z,disabled:c<=-1,className:"pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30","aria-label":"Zpět",children:e.jsx(Ce,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:O,disabled:c===-1?!1:c>=0&&c<p?!H||!!z:!0,className:"pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35","aria-label":c===p-1?"Dokončit":"Další",children:e.jsx(Re,{className:"h-7 w-7"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0",children:[e.jsx("div",{className:"mb-3 shrink-0 pt-1 sm:mb-4",children:u?e.jsx(Ne,{total:j,filled:D}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:p},(N,C)=>e.jsx("div",{className:"h-1.5 max-w-[56px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[64px]",style:{backgroundColor:C<F?ce:"rgba(0,17,97,0.1)"}},C))})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]",children:e.jsx("div",{className:"flex min-h-0 flex-1 flex-col",children:e.jsxs(ke,{mode:"wait",children:[c===-1&&e.jsx(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5",children:e.jsxs("div",{className:"flex min-h-0 w-full flex-1 flex-col justify-center rounded-[18px] border-4 px-5 py-8 text-center shadow-inner sm:rounded-[22px] sm:px-8 sm:py-12 md:px-12",style:{borderColor:ce,backgroundColor:nt},children:[e.jsx("p",{style:{...q,color:ce},className:"text-[16px] font-medium sm:text-[18px]",children:"Vědomostní test pro získání"}),e.jsx("p",{style:{...et,color:ce},className:"mt-4 text-[clamp(1.75rem,5vw,2.75rem)] leading-tight tracking-tight",children:"Certifikátu DVPP"}),e.jsxs("p",{style:{...q,color:ce},className:"mt-6 text-[15px] leading-relaxed opacity-90 sm:text-[16px]",children:["Po webináři ",e.jsx("span",{className:"font-semibold",children:`„${t}“`})]}),e.jsx("p",{style:{...q,color:ce},className:"mt-5 max-w-xl mx-auto text-[14px] leading-relaxed opacity-85 sm:text-[15px]",children:"Certifikát se vám po úspěšném absolvování vědomostního testu zobrazí sám."})]})},"intro"),v&&e.jsxs(W.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain md:overflow-hidden",children:[e.jsx("div",{className:"flex min-h-0 shrink-0 flex-col items-center justify-center px-6 pb-7 pt-8 sm:px-8 sm:pb-6 sm:pt-7 md:flex md:min-h-0 md:flex-[1.15] md:px-14 md:py-6",children:e.jsx("p",{style:{...q,color:tt},className:"max-w-4xl text-center text-[clamp(1.05rem,4.2vw,1.85rem)] font-bold leading-snug sm:text-[clamp(1.1rem,3.5vw,2.05rem)] md:leading-relaxed md:text-[1.85rem] lg:text-[2.1rem]",children:v.label})}),e.jsxs("div",{className:"flex min-h-0 shrink-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pb-7 md:flex md:flex-1 md:justify-end md:pb-7",children:[e.jsx("div",{className:"mx-auto grid w-full max-w-4xl grid-cols-1 gap-2.5 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 md:px-10",children:v.options.slice(0,4).map((N,C)=>{const g=I[C],b=o[v.id]===N,$=b&&d!==null,R=$&&d==="correct",f=$&&d==="wrong";return e.jsxs("button",{type:"button",onClick:()=>V(v.id,N),className:`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${R?"border-emerald-500 bg-emerald-50 shadow-sm":f?"border-red-500 bg-red-50 shadow-sm":b?"border-indigo-500 bg-indigo-50 shadow-sm":"border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md"}`,children:[e.jsx("span",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold md:h-10 md:w-10 md:text-[14px]",style:{...q,backgroundColor:R?"rgba(16,185,129,0.25)":f?"rgba(239,68,68,0.22)":b?"#c7d2fe":"#cbd5e1",color:R?"#047857":f?"#b91c1c":b?"#3730a3":"#475569"},children:g}),e.jsx("span",{style:{...q,color:R?"#065f46":f?"#991b1b":tt},className:"flex min-h-[48px] flex-1 items-center text-[16px] font-medium leading-snug md:text-[18px] md:leading-relaxed",children:N})]},`${v.id}-${C}`)})}),z?e.jsx("p",{style:q,className:"mt-4 text-center text-[12px] text-red-600 sm:mt-5",children:z}):null,e.jsxs("p",{style:{...q},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[c+1," / ",p]})]})]},v.id)]})})})]})]}):e.jsxs("div",{className:"relative flex min-h-0 w-full flex-col rounded-[24px] py-6 px-3 sm:px-6 md:px-10",style:{backgroundColor:"#F3F5FA"},children:[e.jsxs("div",{className:"pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-0 sm:px-1 md:-mx-2",children:[e.jsx("button",{type:"button",onClick:Z,disabled:c<=-1,className:"pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35 disabled:hover:bg-white","aria-label":"Zpět",children:e.jsx(Ce,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:O,disabled:c===-1?!1:c>=0&&c<p?!H||!!z:!0,className:"pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35",style:{backgroundColor:st},"aria-label":c===p-1?"Dokončit":"Další",children:e.jsx(Re,{className:"h-6 w-6"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6",children:[e.jsx("div",{className:"mb-6",children:u?e.jsx(Ne,{total:j,filled:D,className:"mb-0"}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:p},(N,C)=>e.jsx("div",{className:"h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300",style:{backgroundColor:C<F?ce:"rgba(0,17,97,0.12)"}},C))})}),e.jsxs(ke,{mode:"wait",children:[c===-1&&e.jsxs(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"rounded-[20px] border-4 p-6 text-center shadow-sm sm:p-10",style:{borderColor:ce,backgroundColor:nt},children:[e.jsx("p",{style:{...q,color:ce},className:"text-[15px] font-medium sm:text-[16px]",children:"Vědomostní test pro získání"}),e.jsx("p",{style:{...et,color:ce},className:"mt-3 text-[28px] leading-tight tracking-tight sm:text-[36px]",children:"Certifikátu DVPP"}),e.jsxs("p",{style:{...q,color:ce},className:"mt-5 text-[14px] leading-relaxed opacity-90 sm:text-[15px]",children:["Po webináři ",e.jsx("span",{className:"font-semibold",children:`„${t}“`})]}),e.jsx("p",{style:{...q,color:ce},className:"mt-4 max-w-md mx-auto text-[13px] leading-relaxed opacity-85 sm:text-[14px]",children:"Po úspěšném dokončení testu se certifikát zobrazí automaticky v dalším kroku."})]},"intro"),v&&e.jsxs(W.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"rounded-[22px] bg-white p-6 shadow-[0_8px_40px_rgba(0,17,97,0.08)] ring-1 ring-[#001161]/6 sm:p-8",children:[e.jsx("p",{style:{...q,color:"#334155"},className:"text-center text-[21px] font-bold leading-snug sm:text-[24px] sm:leading-snug",children:v.label}),e.jsx("div",{className:"mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2",children:v.options.slice(0,4).map((N,C)=>{const g=I[C],b=o[v.id]===N,$=b&&d!==null,R=$&&d==="correct",f=$&&d==="wrong";return e.jsxs("button",{type:"button",onClick:()=>V(v.id,N),className:`flex w-full items-stretch gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all ${R?"border-emerald-500 bg-emerald-50 shadow-sm":f?"border-red-500 bg-red-50 shadow-sm":b?"border-[#7C3AED] bg-[#7C3AED]/[0.06] shadow-sm":"border-[#E2E8F0] bg-white hover:border-[#001161]/20 hover:bg-slate-50/80"}`,children:[e.jsx("span",{className:"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold",style:{...q,color:R?"#047857":f?"#b91c1c":b?st:"#64748B",backgroundColor:R?"rgba(16,185,129,0.2)":f?"rgba(239,68,68,0.18)":b?"rgba(124,58,237,0.12)":"#F1F5F9"},children:g}),e.jsx("span",{style:{...q,color:R?"#065f46":f?"#991b1b":"#334155"},className:"flex min-h-[44px] items-center text-[16px] font-normal leading-snug sm:text-[17px]",children:N})]},`${v.id}-${C}`)})}),z?e.jsx("p",{style:q,className:"mt-4 text-center text-[12px] text-red-600",children:z}):null,e.jsxs("p",{style:{...q},className:"mt-6 text-center text-[12px] text-slate-400",children:[c+1," / ",p]})]},v.id)]})]})]})}const ae={fontFamily:"'Fenomen Sans', sans-serif"},xs="#E8EBF4",at="#001161",Ee="#4E5871",us="#7C3AED",ot="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-2.5 text-[14px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45";function rt(t,s){return t.type==="intro"?!0:!!s[t.id]?.trim()}function fs({steps:t,answers:s,onAnswerChange:o,onComplete:m,variant:l="default",flowProgressTotal:S,flowProgressFilled:j,onStepChange:D,onSavePartialAnswer:B}){const T=l==="fullscreen",h=t.length,[p,z]=n.useState(0),[w,L]=n.useState(!1),[c,k]=n.useState(""),[x,d]=n.useState(!1),r=n.useRef(!1),F=n.useRef(!1),u=h>0?t[p]:null,v=p;n.useEffect(()=>{D?.(p)},[p,D]),n.useEffect(()=>{k("")},[p]);const H=typeof S=="number"&&S>0&&typeof j=="number",V=n.useCallback(()=>{z(g=>Math.max(0,g-1))},[]),Z=n.useCallback(()=>{!u||h===0||rt(u,s)&&(r.current||w||(r.current=!0,d(!0),(async()=>{try{if(B&&u.type!=="intro"){let g="";if((u.type==="open"||u.type==="abc")&&(g=(s[u.id]||"").trim()),g)try{await B(u.id,g)}catch(b){k(b instanceof Error?b.message:"Uložení se nezdařilo");return}}if(p>=h-1){m();return}z(g=>g+1)}finally{r.current=!1,d(!1)}})()))},[u,s,p,h,m,B,w]),O=n.useCallback(async()=>{if(!u||u.type==="intro"||!B||F.current)return;let g="";if(u.type==="open")g=(s[u.id]||"").trim();else if(u.type==="abc")g=(s[u.id]||"").trim();else return;if(g){F.current=!0,k(""),L(!0);try{await B(u.id,g)}catch(b){k(b instanceof Error?b.message:"Uložení se nezdařilo")}finally{F.current=!1,L(!1)}}},[u,s,B]);if(h===0||!u)return null;const I=["A","B","C","D"],N=()=>u.type==="intro"?e.jsx(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5",children:e.jsxs("div",{className:"flex min-h-0 w-full flex-1 flex-row items-center gap-4 rounded-[20px] px-5 py-8 shadow-inner sm:gap-8 sm:rounded-[28px] sm:px-8 sm:py-10 md:px-12",style:{backgroundColor:"#475569"},children:[e.jsx("div",{className:"flex shrink-0 items-center justify-center text-[clamp(3.5rem,12vw,5rem)] leading-none","aria-hidden":!0,children:"🤔"}),e.jsxs("div",{className:"min-w-0 flex-1 text-left",children:[e.jsx("p",{style:{...ae,color:"#fff"},className:"text-[clamp(1.1rem,3vw,1.45rem)] font-semibold leading-snug",children:u.title}),u.subtitle?e.jsx("p",{style:{...ae,color:"rgba(255,255,255,0.85)"},className:"mt-3 text-[16px] leading-relaxed sm:text-[17px]",children:u.subtitle}):null]})]})},u.id):u.type==="open"?e.jsxs(W.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-12 sm:py-8 md:px-14",children:[e.jsxs("div",{className:"flex min-h-0 flex-1 flex-col items-center",children:[e.jsx("p",{style:{...ae,color:Ee},className:"max-w-4xl text-center text-[clamp(1.3rem,3.2vw,1.85rem)] font-bold leading-snug md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]",children:u.label}),u.sublabel?e.jsx("p",{style:{...ae,color:Ee},className:"mt-4 max-w-4xl text-center text-[16px] leading-relaxed opacity-90 sm:text-[17px]",children:u.sublabel}):null,e.jsx("textarea",{value:s[u.id]||"",onChange:g=>o(u.id,g.target.value),placeholder:u.placeholder||"Vaše odpověď",rows:T?8:5,className:"mt-6 w-full max-w-4xl flex-1 min-h-[140px] resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-[15px] text-[#334155] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 sm:min-h-[180px] md:text-[16px]",style:ae}),B?e.jsxs("div",{className:"mt-5 flex w-full max-w-4xl flex-col items-center gap-2",children:[e.jsxs("button",{type:"button",disabled:w||x||!(s[u.id]||"").trim(),onClick:()=>void O(),className:ot,style:ae,children:[w?e.jsx(pe,{className:"h-4 w-4 animate-spin"}):null,"Odpovědět"]}),c?e.jsx("p",{style:ae,className:"text-center text-[12px] text-red-600",children:c}):null]}):null]}),e.jsxs("p",{style:{...ae},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[p+1," / ",h]})]},u.id):e.jsxs(W.div,{initial:{opacity:0,y:12},animate:{opacity:1,y:0},exit:{opacity:0,y:-8},transition:{duration:.2},className:"flex min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain md:overflow-hidden",children:[e.jsx("div",{className:"flex min-h-0 shrink-0 flex-col items-center justify-center px-6 pb-7 pt-8 sm:px-10 sm:pb-6 sm:pt-7 md:flex md:min-h-0 md:flex-[1.05] md:px-14 md:py-6",children:e.jsx("p",{style:{...ae,color:Ee},className:"max-w-4xl text-center text-[clamp(1.05rem,4vw,1.85rem)] font-bold leading-snug sm:text-[clamp(1.2rem,3.2vw,1.85rem)] md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]",children:u.label})}),e.jsxs("div",{className:"flex min-h-0 shrink-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pb-7 md:flex md:flex-1 md:justify-end md:pb-7",children:[e.jsx("div",{className:"mx-auto grid w-full max-w-4xl grid-cols-1 gap-2.5 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 md:px-10",children:u.options.slice(0,4).map((g,b)=>{const $=I[b],R=s[u.id]===g;return e.jsxs("button",{type:"button",onClick:()=>o(u.id,g),className:`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${R?"border-indigo-500 bg-indigo-50 shadow-sm":"border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md"}`,children:[e.jsx("span",{className:"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold md:h-10 md:w-10 md:text-[14px]",style:{...ae,backgroundColor:R?"#c7d2fe":"#cbd5e1",color:R?"#3730a3":"#475569"},children:$}),e.jsx("span",{style:{...ae,color:Ee},className:"flex min-h-[48px] flex-1 items-center text-[16px] font-medium leading-snug md:text-[18px] md:leading-relaxed",children:g})]},`${u.id}-${b}`)})}),B&&s[u.id]?.trim()?e.jsxs("div",{className:"mx-auto mt-4 flex w-full max-w-4xl flex-col items-center gap-2 px-4 sm:px-6 md:px-10",children:[e.jsxs("button",{type:"button",disabled:w||x,onClick:()=>void O(),className:ot,style:ae,children:[w?e.jsx(pe,{className:"h-4 w-4 animate-spin"}):null,"Odpovědět"]}),c?e.jsx("p",{style:ae,className:"text-center text-[12px] text-red-600",children:c}):null]}):null,e.jsxs("p",{style:{...ae},className:"mt-4 text-center text-[12px] text-slate-400 sm:mt-5",children:[p+1," / ",h]})]})]},u.id),C=!rt(u,s)||x||w;return T?e.jsxs("div",{className:"relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]",style:{backgroundColor:xs},children:[e.jsxs("div",{className:`pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0`,children:[e.jsx("button",{type:"button",onClick:V,disabled:p<=0,className:"pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30","aria-label":"Zpět",children:e.jsx(Ce,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:Z,disabled:C,className:"pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35","aria-label":p>=h-1?"Dokončit":"Další",children:e.jsx(Re,{className:"h-7 w-7"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0",children:[e.jsx("div",{className:"mb-3 shrink-0 pt-1 sm:mb-4",children:H?e.jsx(Ne,{total:S,filled:j}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:h},(g,b)=>e.jsx("div",{className:"h-1.5 max-w-[56px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[64px]",style:{backgroundColor:b<v?at:"rgba(0,17,97,0.1)"}},b))})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]",children:e.jsx("div",{className:"flex min-h-0 flex-1 flex-col",children:e.jsx(ke,{mode:"wait",children:N()})})})]})]}):e.jsxs("div",{className:"relative flex min-h-0 w-full flex-col rounded-[24px] py-6 px-3 sm:px-6 md:px-10",style:{backgroundColor:"#F3F5FA"},children:[e.jsxs("div",{className:"pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-0 sm:px-1 md:-mx-2",children:[e.jsx("button",{type:"button",onClick:V,disabled:p<=0,className:"pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35","aria-label":"Zpět",children:e.jsx(Ce,{className:"h-6 w-6"})}),e.jsx("button",{type:"button",onClick:Z,disabled:C,className:"pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35",style:{backgroundColor:us},"aria-label":p>=h-1?"Dokončit":"Další",children:e.jsx(Re,{className:"h-6 w-6"})})]}),e.jsxs("div",{className:"relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6",children:[e.jsx("div",{className:"mb-6",children:H?e.jsx(Ne,{total:S,filled:j}):e.jsx("div",{className:"flex justify-center gap-1.5 px-2",children:Array.from({length:h},(g,b)=>e.jsx("div",{className:"h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300",style:{backgroundColor:b<v?at:"rgba(0,17,97,0.12)"}},b))})}),e.jsx("div",{className:"min-h-[min(70vh,520px)] overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80",children:e.jsx("div",{className:"flex min-h-[min(70vh,520px)] flex-col",children:e.jsx(ke,{mode:"wait",children:N()})})})]})]})}const hs=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`;function gs(t){const s=t.replace(/\uFEFF/g,"").trim();if(!s)return null;try{return JSON.parse(s)}catch{let o=s;for(let m=0;m<8;m++){const l=o.match(/^(true|false|null)\b\s*(?:,\s*)?/i);if(!l)break;o=o.slice(l[0].length).trim()}return JSON.parse(o)}}async function it(t){const s=String(t.participantName??"").trim(),o=await fetch(`${hs}/webinar-survey-partial`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.webinarId??"").trim(),email:t.email.trim(),questionId:t.questionId.trim(),value:t.value,...s?{participantName:s}:{}})}),m=await o.text();let l={};try{l=gs(m)||{}}catch{return{ok:!1,error:o.ok?"Neplatná odpověď serveru":`Server (${o.status})`}}return o.ok?l.success?l.wrongAnswer?{ok:!0,wrongAnswer:!0}:{ok:!0}:{ok:!1,error:l.error||"Uložení se nezdařilo"}:o.status===404?{ok:!1,error:"Uložení odpovědi na serveru není k dispozici (404). Je potřeba znovu nasadit Edge funkci make-server-93a20b6f (endpoint webinar-survey-partial)."}:{ok:!1,error:l.error||`HTTP ${o.status}`}}const bs=`https://${je}.supabase.co/functions/v1/make-server-93a20b6f`,J={fontFamily:"'Fenomen Sans', sans-serif"};function vs(t,s){const o=(s[t.id]||"").trim();return t.type==="open"||t.type==="abc"?o.length>0:t.type==="yes_no"?o==="yes"||o==="no":!0}function ys(t){const s=t.replace(/\uFEFF/g,"").trim();if(!s)return null;try{return JSON.parse(s)}catch{let o=s;for(let m=0;m<8;m++){const l=o.match(/^(true|false|null)\b\s*(?:,\s*)?/i);if(!l)break;o=o.slice(l[0].length).trim()}return JSON.parse(o)}}function Me({webinar:t,email:s,onAnswersChange:o,variant:m="default",scope:l="post",certificateKindOverride:S,participantName:j="",participantBirthDateIso:D="",participantSchoolName:B="",participantSchoolIco:T=""}){const h=m==="fullscreen",p=n.useMemo(()=>l==="pre"?mt(t):xt(t),[t,l]),z=n.useMemo(()=>l==="pre"?new Set:new Set(Lt(t).map(i=>i.id)),[t,l]),w=n.useMemo(()=>l==="post"?Vt(t):new Set,[t,l]),L=n.useMemo(()=>l==="post"?Tt(t):[],[t,l]),c=n.useMemo(()=>p.filter(i=>!z.has(i.id)&&!w.has(i.id)),[p,z,w]),k=n.useMemo(()=>{if(l==="pre")return[];const i=t.postWebinarQuizQuestions;return Array.isArray(i)?i.filter(_=>!!_&&_.type==="abc"&&typeof _.label=="string"&&_.label.trim().length>0&&Array.isArray(_.options)&&_.options.length>=2):[]},[t,l]),x=S??(k.length>0?"dvpp":"feedback"),[d,r]=n.useState({}),[F,u]=n.useState(!1),[v,H]=n.useState(""),[V,Z]=n.useState(!1),[O,I]=n.useState(!1),[N,C]=n.useState(!1),[g,b]=n.useState(!1),[$,R]=n.useState(-1),[f,P]=n.useState(0),[E,G]=n.useState(null),[ee,te]=n.useState(null),[Y,de]=n.useState(""),se=n.useMemo(()=>c.every(i=>vs(i,d)),[c,d]);n.useEffect(()=>{o?.(d)},[d,o]);const he=n.useRef(!1),ge=n.useRef(!1);n.useEffect(()=>{R(-1),P(0),he.current=!1},[t.id]);const K=l==="post",ne=K&&k.length>0?1+k.length:0,le=K?L.length:0,be=K?1:0,oe=k.length>0&&!N,re=l==="post"&&L.length>0&&!g&&(k.length===0||N),X=n.useMemo(()=>K?oe?ne:re?ne+le:c.length>0?ne+le+be:Math.max(ne+le+be,1):0,[K,oe,re,c.length,ne,le,be]),we=n.useMemo(()=>{if(!K||X===0)return 0;if(V)return X;if(oe)return $<0?0:Math.min(1+$,X);if(re){const i=Math.min(f+1,le);return Math.min(ne+i,X)}return X},[K,X,V,oe,re,$,f,ne,le]),ve=n.useCallback(async()=>{if(c.length>0&&!se){H("Vyplňte prosím všechny otázky v této části.");return}if(!ge.current){ge.current=!0,u(!0),H("");try{const i=await fetch(`${bs}/webinar-survey-submit`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),answers:d})}),_=await i.text();let M={};try{M=ys(_)||{}}catch{const me=_.trim(),We=i.status===404&&(me==="404 Not Found"||me==="Not Found"||/^404\b/i.test(me));throw new Error(We?"Dotazník na serveru nenalezen — nasaďte prosím edge funkci make-server-93a20b6f (webinar-survey-submit) nebo zkuste později.":i.ok?"Neplatná odpověđ serveru":`Server (${i.status}): ${_.slice(0,200)}`)}if(!i.ok)throw new Error(M.error||`HTTP ${i.status}`);Z(!0)}catch(i){H(i instanceof Error?i.message:"Chyba")}finally{ge.current=!1,u(!1)}}},[d,s,t.id,c.length,se,j]),De=n.useCallback(async(i,_)=>{if(l!=="post")return;const M=await it({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),questionId:i,value:_});if(!M.ok)throw new Error(M.error||"Chyba");return"wrongAnswer"in M&&M.wrongAnswer?{wrongAnswer:!0}:void 0},[l,t.id,s,j]),Ue=n.useCallback(async i=>{if(l!=="post")return;const _=(d[i.id]||"").trim();if(_){de(""),G(i.id);try{const M=await it({webinarId:String(t.id??"").trim(),email:s.trim(),participantName:(j||"").trim(),questionId:i.id,value:_});if(!M.ok)throw new Error(M.error||"Chyba");te(i.id),window.setTimeout(()=>{te(me=>me===i.id?null:me)},2200)}catch(M){de(M instanceof Error?M.message:"Chyba")}finally{G(null)}}},[l,t.id,s,d,j]);return n.useEffect(()=>{l==="post"&&(V||O||p.length!==0&&(oe||re||c.length>0||F||he.current||(he.current=!0,ve())))},[l,V,O,p.length,oe,re,c.length,F,ve]),V?l==="post"?e.jsx("div",{className:h?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"w-full",children:e.jsx(cs,{webinar:t,email:s,participantName:j,participantBirthDateIso:D,participantSchoolName:B,participantSchoolIco:T,variant:h?"fullscreen":"default",certificateKind:x})}):e.jsx(W.div,{initial:{opacity:0,y:6},animate:{opacity:1,y:0},className:h?"flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center":"w-full mt-6 border-t border-[#001161]/10 pt-6 text-left",children:e.jsx("p",{style:J,className:"text-[13px] text-[#001161]/70",children:"Děkujeme za odpovědi — pomůhá nám to připravit obsah."})}):p.length===0||O?null:oe?e.jsxs(W.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:h?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[e.jsx(ms,{variant:h?"fullscreen":"default",webinarTitle:t.title,questions:k,answers:d,onAnswerChange:(i,_)=>r(M=>({...M,[i]:_})),onComplete:()=>C(!0),flowProgressTotal:X,flowProgressFilled:we,onStepChange:R,onSavePartialAnswer:l==="post"?De:void 0},t.id),h?null:e.jsx("div",{className:"mt-4 flex justify-center",children:e.jsx("button",{type:"button",onClick:()=>I(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:J,children:"Přeskočit celý dotazník"})})]}):re?e.jsxs(W.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:h?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[e.jsx(fs,{variant:h?"fullscreen":"default",steps:L,answers:d,onAnswerChange:(i,_)=>r(M=>({...M,[i]:_})),onComplete:()=>b(!0),flowProgressTotal:X,flowProgressFilled:we,onStepChange:P,onSavePartialAnswer:l==="post"?De:void 0}),h?null:e.jsx("div",{className:"mt-4 flex justify-center",children:e.jsx("button",{type:"button",onClick:()=>I(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:J,children:"Přeskočit celý dotazník"})})]}):l==="post"&&c.length===0&&!oe&&!re?e.jsxs(W.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:h?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[X>0?e.jsx("div",{className:h?"mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0":"mb-4 flex justify-center",children:e.jsx(Ne,{total:X,filled:we})}):null,e.jsx("div",{className:h?"mx-auto flex w-full max-w-[min(720px,100%)] flex-col items-center":"flex flex-col items-center",children:v?e.jsxs(e.Fragment,{children:[e.jsx("p",{style:J,className:"mb-3 text-[13px] text-red-600",children:v}),e.jsxs("div",{className:"mt-2 flex flex-wrap items-center gap-3",children:[e.jsxs("button",{type:"button",disabled:F,onClick:ve,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50",style:J,children:[F?e.jsx(pe,{className:"h-4 w-4 animate-spin"}):null,"Odeslat odpovědi"]}),e.jsx("button",{type:"button",disabled:F,onClick:()=>I(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:J,children:"Přeskočit"})]})]}):e.jsx("div",{className:"flex justify-center py-10","aria-busy":"true","aria-live":"polite",children:e.jsx(pe,{className:"h-8 w-8 animate-spin text-[#001161]"})})})]}):e.jsxs(W.div,{id:"webinar-dotaznik",initial:{opacity:0,y:8},animate:{opacity:1,y:0},className:h?"flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12":"mt-6 w-full border-t border-[#001161]/10 pt-6 text-left",children:[X>0?e.jsx("div",{className:h?"mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0":"mb-4 flex justify-center",children:e.jsx(Ne,{total:X,filled:we})}):null,e.jsxs("div",{className:h?"mx-auto w-full max-w-[min(720px,100%)]":void 0,children:[c.length>0&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"flex items-start gap-3 mb-4",children:[e.jsx("div",{className:"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#001161]/8",children:e.jsx(Wt,{className:"h-5 w-5 text-[#001161]"})}),e.jsx("div",{children:e.jsx("h3",{style:J,className:"text-[16px] font-bold text-[#001161] leading-snug",children:"Pomozte nám porozumět, kdo přichází na webinář"})})]}),e.jsx("div",{className:"space-y-4",children:c.map(i=>e.jsxs("div",{children:[e.jsx("label",{style:J,className:"block text-[13px] font-semibold text-[#001161] mb-1.5",children:i.label}),i.type==="open"&&e.jsx("textarea",{value:d[i.id]||"",onChange:_=>r(M=>({...M,[i.id]:_.target.value})),rows:3,className:"w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",style:J}),i.type==="abc"&&i.options&&i.options.length>0&&e.jsx("div",{className:"flex flex-col gap-2",children:i.options.map(_=>e.jsxs("label",{className:"flex cursor-pointer items-center gap-2 rounded-xl border border-[#001161]/10 bg-white px-3 py-2 text-[14px] text-[#001161] hover:bg-[#F0F2F8]",style:J,children:[e.jsx("input",{type:"radio",name:i.id,checked:d[i.id]===_,onChange:()=>r(M=>({...M,[i.id]:_})),className:"accent-[#001161]"}),_]},_))}),i.type==="yes_no"&&e.jsx("div",{className:"flex flex-wrap gap-2",children:[{v:"yes",l:"Ano"},{v:"no",l:"Ne"}].map(({v:_,l:M})=>e.jsx("button",{type:"button",onClick:()=>r(me=>({...me,[i.id]:_})),className:`rounded-xl px-4 py-2 text-[14px] font-bold transition-all ${d[i.id]===_?"bg-[#001161] text-white shadow-md":"bg-[#F0F2F8] text-[#001161] hover:bg-[#e4e8f4]"}`,style:J,children:M},_))}),l==="post"?e.jsxs("div",{className:"mt-3 flex flex-wrap items-center gap-2",children:[e.jsxs("button",{type:"button",disabled:E===i.id||!(i.type==="open"&&(d[i.id]||"").trim()||i.type==="abc"&&i.options&&i.options.length>0&&(d[i.id]||"").trim()||i.type==="yes_no"&&(d[i.id]==="yes"||d[i.id]==="no")),onClick:()=>void Ue(i),className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2 text-[13px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45",style:J,children:[E===i.id?e.jsx(pe,{className:"h-3.5 w-3.5 animate-spin"}):null,"Odpovědět"]}),ee===i.id?e.jsxs("span",{style:J,className:"inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600",children:[e.jsx(Gt,{className:"h-3.5 w-3.5 shrink-0"}),"Uloženo"]}):null]}):null]},i.id))}),l==="post"&&Y?e.jsx("p",{style:J,className:"mt-2 text-[13px] text-red-600",children:Y}):null]}),v?e.jsx("p",{style:J,className:"mt-3 text-[13px] text-red-600",children:v}):null,e.jsxs("div",{className:"mt-5 flex flex-wrap items-center gap-3",children:[e.jsxs("button",{type:"button",disabled:F||c.length>0&&!se,onClick:ve,className:"inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50",style:J,children:[F?e.jsx(pe,{className:"h-4 w-4 animate-spin"}):null,"Odeslat odpovědi"]}),e.jsx("button",{type:"button",disabled:F,onClick:()=>I(!0),className:"text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70",style:J,children:"Přeskočit"})]})]})]})}function ws({form:t,notTeacher:s,onTogglePedagogMode:o,handleChange:m,handleSubmit:l,handleSchoolNameChange:S,handleSchoolSelect:j,handleIcoChange:D,schoolContainerRef:B,schoolResults:T,schoolOpen:h,setSchoolOpen:p,schoolSearching:z,error:w,submitting:L,positions:c,submitButtonText:k="Přihlásit"}){return e.jsxs("form",{onSubmit:l,noValidate:!0,className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"flex items-center justify-between bg-white rounded-[12px] px-4 py-3 border border-[#001161]/10",children:[e.jsxs("div",{children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-[#001161] leading-tight",children:s?"Nejsem pedagog":"Jsem pedagog"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 leading-tight mt-0.5",children:s?"Nepotřebuji certifikát DVPP":"Po webináři obdržím certifikát DVPP"})]}),e.jsx("button",{type:"button",onClick:o,className:`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#001161]/30 ${s?"bg-red-500":"bg-emerald-600"}`,"aria-checked":!s,role:"switch","aria-label":s?"Zapnout režim pedagog s certifikátem DVPP":"Vypnout — nejsem pedagog",children:e.jsx("span",{className:`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${s?"translate-x-0":"translate-x-5"}`})})]}),e.jsx(ke,{initial:!1,children:!s&&e.jsxs(W.div,{initial:{opacity:0,height:0},animate:{opacity:1,height:"auto"},exit:{opacity:0,height:0},transition:{duration:.22},className:"flex flex-col gap-3 overflow-visible",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-1 pl-1",children:"Informace o škole"}),e.jsxs("div",{ref:B,className:"relative",children:[e.jsx("input",{type:"text",value:t.schoolName,onChange:x=>S(x.target.value),onFocus:()=>T.length>0&&p(!0),placeholder:" Název školy",autoComplete:"off",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30",children:z?e.jsx(pe,{className:"w-4 h-4 animate-spin"}):e.jsx(ut,{className:"w-4 h-4"})}),e.jsx(ke,{children:h&&T.length>0&&e.jsx(W.div,{initial:{opacity:0,y:-6},animate:{opacity:1,y:0},exit:{opacity:0,y:-6},transition:{duration:.15},className:"absolute z-[100] mt-1 w-full bg-white border border-[#001161]/10 rounded-2xl shadow-xl overflow-hidden",children:e.jsx("div",{className:"max-h-[220px] overflow-y-auto py-1",children:T.map((x,d)=>e.jsxs("button",{type:"button",onClick:()=>j(x),className:"w-full text-left px-4 py-3 hover:bg-[#F0F2F8] transition-colors flex items-start gap-3 group",children:[e.jsx(ft,{className:"w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0 group-hover:text-[#5B4FD8] transition-colors"}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] font-semibold leading-tight truncate",children:x.name}),x.address?e.jsxs("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 mt-0.5",children:[x.address," · IČO: ",x.ico]}):null]})]},`${x.ico}-${d}`))})})})]}),e.jsx("input",{type:"text",inputMode:"numeric",value:t.ico,onChange:x=>D(x.target.value),placeholder:"IČO školy",maxLength:10,className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"})]},"school-section")}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1",children:"Kontaktní údaje"}),e.jsx("input",{type:"text",required:!0,value:t.name,onChange:x=>m("name",x.target.value),placeholder:"Jméno a příjmení *",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("input",{type:"email",required:!0,value:t.email,onChange:x=>m("email",x.target.value),placeholder:"Váš e-mail *",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsx("input",{type:"tel",value:t.phone,onChange:x=>m("phone",x.target.value),placeholder:"Telefon",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"}),e.jsxs("div",{className:"relative",children:[e.jsxs("select",{required:!0,value:t.position,onChange:x=>m("position",x.target.value),className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all appearance-none cursor-pointer",style:{color:t.position?"#001161":"rgba(0,17,97,0.4)"},children:[e.jsx("option",{value:"",disabled:!0,children:"Vaše pozice *"}),c.map(x=>e.jsx("option",{value:x,children:x},x))]}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/40",children:e.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 9l-7 7-7-7"})})})]}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1",children:"Webinář"}),e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-1 block",children:"S jakou motivací přicházíte na tento webinář?"}),e.jsx("textarea",{rows:4,value:t.webinarMotivation,onChange:x=>m("webinarMotivation",x.target.value),placeholder:"Krátce popište, co vás k akci vede…",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all resize-y min-h-[96px]"})]}),e.jsxs("label",{className:"block",children:[e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-1 block",children:"Co by vás u tématu nejvíce zajímalo?"}),e.jsx("textarea",{rows:4,value:t.webinarTopicInterest,onChange:x=>m("webinarTopicInterest",x.target.value),placeholder:"Témata, otázky nebo očekávání…",className:"w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all resize-y min-h-[96px]"})]}),e.jsxs("div",{children:[e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 mb-2 block",children:"Používám Vividbooks *"}),e.jsxs("div",{className:"flex flex-wrap gap-4",children:[e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]",children:[e.jsx("input",{type:"radio",name:"usesVividbooks",required:!0,checked:t.usesVividbooks==="yes",onChange:()=>m("usesVividbooks","yes"),className:"w-4 h-4 accent-[#5B4FD8]"}),"Ano"]}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]",children:[e.jsx("input",{type:"radio",name:"usesVividbooks",required:!0,checked:t.usesVividbooks==="no",onChange:()=>m("usesVividbooks","no"),className:"w-4 h-4 accent-[#5B4FD8]"}),"Ne"]})]})]}),e.jsxs("label",{className:"flex items-start gap-3 cursor-pointer mt-1",children:[e.jsx("div",{className:`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${t.gdpr?"bg-[#5B4FD8] border-[#5B4FD8]":"bg-white border-[#001161]/20"}`,onClick:()=>m("gdpr",!t.gdpr),children:t.gdpr?e.jsx("svg",{className:"w-3 h-3 text-white",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:3,d:"M5 13l4 4L19 7"})}):null}),e.jsxs("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 leading-snug",onClick:()=>m("gdpr",!t.gdpr),children:["Souhlasím se zpracováním osobních údajů podle ",e.jsx("a",{href:Nt(),target:"_blank",rel:"noopener noreferrer",className:"underline text-[#5B4FD8] hover:opacity-75",onClick:x=>x.stopPropagation(),children:"Zásad ochrany osobních údajů"}),". *"]})]}),e.jsxs("label",{className:"flex items-start gap-3 cursor-pointer bg-[#FFF7ED] rounded-xl px-4 py-3 border border-[#E8942A]/20",children:[e.jsxs("span",{className:"relative flex-shrink-0 mt-0.5",children:[e.jsx("input",{type:"checkbox",checked:t.newsletter,onChange:()=>m("newsletter",!t.newsletter),className:"sr-only peer"}),e.jsx("span",{className:"block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors"}),e.jsx("span",{className:"absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]"})]}),e.jsxs("span",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/80 leading-[1.5]",children:[e.jsx("span",{className:"font-bold text-[#001161]",children:"📚 Chci dostávat novinky a tipy do výuky"}),e.jsx("br",{}),"Novinky, tipy do výuky a akce — posíláme je jen tehdy, když stojí za přečtení. Bez spamu."]})]}),w?e.jsxs("div",{className:"flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3",children:[e.jsx(pt,{className:"w-4 h-4 text-red-500 shrink-0"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-red-600 text-[13px]",children:w})]}):null,e.jsx("button",{type:"submit",disabled:L,className:"w-full bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[16px] py-4 rounded-[14px] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,140,0,0.35)]",children:L?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"}),"Odesílám..."]}):k}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 text-center",children:"* Povinné pole"})]})}function js(t){try{return decodeURIComponent(t)}catch{return t}}const ks=["Učitel/ka na ZŠ","Učitel/ka na SŠ","Učitel/ka na VOŠ nebo VŠ","Ředitel/ka školy","Výchovný/á poradce/poradkyně","Pedagogický pracovník/ce","Rodič","Jiné"],lt="uses_vividbooks";function _e(t){return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}function Ns(t,s){if(!s?.length)return null;const o=_e(String(t.slug||t.id||"")),m=_e(String(t.title||"")),l=s.find(j=>_e(String(j.slug||j.id||""))===o);return l||(s.find(j=>{const D=_e(String(j.name||j.title||""));return m.length>5&&(D.includes(m.slice(0,Math.floor(m.length*.7)))||m.includes(D.slice(0,Math.floor(D.length*.7))))})??null)}function Ss({webinar:t}){const s=St(),o=zt(),[m]=Ft(),l=m.get("dotaznik"),S=m.get("dvppDotaznik"),{webinars:j}=ct(),{videos:D,loading:B}=Ct(),T=n.useMemo(()=>Ns(t,D),[t,D]);t.surveyRequireFullRegistration;const h=n.useMemo(()=>{if(typeof t.surveyRequireFullRegistration=="boolean")return t.surveyRequireFullRegistration;const a=T?.surveyRequireFullRegistration;return typeof a=="boolean"?a:!1},[t.surveyRequireFullRegistration,T]),p=n.useMemo(()=>xt(t),[t]),z=n.useMemo(()=>mt(t),[t]),w=n.useMemo(()=>z.some(a=>a.id===lt),[z]),[L,c]=n.useState({}),k=n.useCallback(a=>{c(a)},[]),x=n.useMemo(()=>S==="1"&&p.length>0&&t.isPast,[S,p.length,t.isPast]),d=n.useMemo(()=>z.length===0||!w?!0:L[lt]==="no",[z.length,w,L]),[r,F]=n.useState({name:"",email:"",phone:"",position:"",gdpr:!1,newsletter:!1,schoolName:"",ico:"",schoolAddress:"",webinarMotivation:"",webinarTopicInterest:"",usesVividbooks:"",birthDateIso:""}),[u,v]=n.useState(!1),[H,V]=n.useState(!1),[Z,O]=n.useState(!1),[I,N]=n.useState(!1),[C,g]=n.useState(()=>typeof window<"u"?Te():[]);n.useEffect(()=>{N(!1)},[t.id]),n.useEffect(()=>{!x||I||g(Te())},[x,I,t.id]);const[b,$]=n.useState(!1),[R,f]=n.useState(""),[P,E]=n.useState(!1),[G,ee]=n.useState(null),[te,Y]=n.useState([]),[de,se]=n.useState(!1),[he,ge]=n.useState(!1),K=n.useRef(null),ne=n.useRef(null);n.useEffect(()=>{const a=y=>{K.current&&!K.current.contains(y.target)&&se(!1)};return document.addEventListener("mousedown",a),()=>document.removeEventListener("mousedown",a)},[]),n.useLayoutEffect(()=>{if(!t.isPast||l!=="1"||p.length===0)return;const a=new URLSearchParams(m);if(a.delete("dotaznik"),a.get("prehled")==="1"){s(`${o.pathname}?${a.toString()}`,{replace:!0});return}a.set("dvppDotaznik","1"),s(`${o.pathname}?${a.toString()}`,{replace:!0})},[t.isPast,t.id,l,p.length,m,s,o.pathname]),n.useLayoutEffect(()=>{if(!t.isPast||p.length===0)return;const a=new URLSearchParams(m);a.get("dvppDotaznik")==="1"||a.get("prehled")==="1"||(a.set("dvppDotaznik","1"),s(`${o.pathname}?${a.toString()}`,{replace:!0}))},[t.isPast,t.id,p.length,m,s,o.pathname]),n.useEffect(()=>{if(typeof window>"u")return;const a=new URLSearchParams(window.location.search),y=a.get("email"),A=y?js(y.trim()):"";if(!A||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(A))return;const xe=a.get("dvppDotaznik")==="1",ye=a.get("dotaznik")==="1";if(xe){if(!t.isPast||p.length===0)return;F(ue=>({...ue,email:A})),$(!0),O(!1),window.history.replaceState({},"",`${window.location.pathname}?dvppDotaznik=1`);return}if(ye){if(t.isPast||z.length===0)return;F(ue=>({...ue,email:A})),V(!0),$(!0),window.history.replaceState({},"",`${window.location.pathname}?dotaznik=1`)}},[t.id,t.isPast,p.length,z.length]),n.useEffect(()=>{if(!b||z.length===0||t.isPast)return;const a=window.setTimeout(()=>{document.getElementById("webinar-dotaznik")?.scrollIntoView({behavior:"smooth",block:"start"})},500);return()=>window.clearTimeout(a)},[b,t.id,z.length,t.isPast]);const le=async a=>{if(a.trim().length<2){Y([]),se(!1);return}ge(!0);try{const A=await(await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/school-search?q=${encodeURIComponent(a)}`,{headers:{Authorization:`Bearer ${fe}`}})).json();Y(A.results||[]),se((A.results||[]).length>0)}catch{Y([])}finally{ge(!1)}},be=a=>{F(y=>({...y,schoolName:a})),ne.current&&clearTimeout(ne.current),ne.current=setTimeout(()=>le(a),350),f("")},oe=a=>{F(y=>({...y,schoolName:a.name,ico:a.ico,schoolAddress:typeof a.address=="string"?a.address.trim():""})),se(!1),Y([])},re=a=>{F(y=>({...y,ico:a.replace(/\D/g,"").slice(0,10)})),f("")},X=n.useCallback(a=>{F(y=>({...y,name:a.name,email:a.email,birthDateIso:a.birthDateIso,schoolName:a.schoolName,ico:a.ico,schoolAddress:""})),se(!1),Y([]),f("")},[]),we=j.filter(a=>a.id!==t.id&&!a.isPast).slice(0,2),ve=new Date(t.year,(t.monthNum||1)-1,t.day||1,...(t.time||"18:00").split(":").map(Number)),De=new Date(ve.getTime()+90*6e4),Se=(Date.now()-ve.getTime())/6e4,i=!t.isPast&&Se>-30&&Se<150,me=(typeof localStorage<"u"?localStorage.getItem("vvb_dev_imminent"):null)===t.id&&!t.isPast,ze=`${typeof window<"u"?window.location.origin:"http://localhost:3000".replace(/\/$/,"")}/webinar/${t.id}/live`,ht=()=>{const a=G?.calendar?.icsBase64;if(!a){Ge();return}try{const y=atob(a),A=new Uint8Array(y.length);for(let Pe=0;Pe<y.length;Pe++)A[Pe]=y.charCodeAt(Pe);const xe=new Blob([A],{type:"text/calendar;charset=utf-8"}),ye=URL.createObjectURL(xe),ue=document.createElement("a");ue.href=ye,ue.download=`webinar-${t.slug||t.id}.ics`,ue.click(),URL.revokeObjectURL(ye)}catch{Ge()}},Ge=()=>{const a=ue=>ue.toISOString().replace(/[-:]|\\.\\d{3}/g,"").slice(0,15)+"Z",y=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Vividbooks//Webinar//CS","BEGIN:VEVENT",`UID:webinar-${t.id}@vividbooks.cz`,`DTSTAMP:${a(new Date)}`,`DTSTART:${a(ve)}`,`DTEND:${a(De)}`,`SUMMARY:${t.title}`,`DESCRIPTION:Webinář Vividbooks\\nPřipojte se: ${ze}`,`URL:${ze}`,`LOCATION:${ze}`,"END:VEVENT","END:VCALENDAR"].join(`\r
`),A=new Blob([y],{type:"text/calendar;charset=utf-8"}),xe=URL.createObjectURL(A),ye=document.createElement("a");ye.href=xe,ye.download=`webinar-${t.id}.ics`,ye.click(),URL.revokeObjectURL(xe)},$e=(a,y)=>{F(A=>({...A,[a]:y})),f("")},gt=n.useMemo(()=>{const a=r.ico.replace(/\D/g,"");return r.name.trim().length>0&&r.email.trim().length>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.birthDateIso.trim())&&r.schoolName.trim().length>0&&a.length>=8},[r.name,r.email,r.birthDateIso,r.schoolName,r.ico]),bt=n.useCallback(()=>{E(a=>{const y=!a;return a||(F(A=>({...A,schoolName:"",ico:"",schoolAddress:""})),Y([]),se(!1)),y})},[]),vt=async a=>{if(a.preventDefault(),!P&&!r.schoolName.trim()){f("Vyplňte prosím název školy.");return}if(!P&&!r.ico.trim()){f("Vyplňte prosím IČO školy.");return}if(!r.name.trim()||!r.email.trim()||!r.position){f("Vyplňte prosím všechna povinná pole.");return}if(!r.gdpr){f("Souhlas se zpracováním osobních údajů je povinný.");return}if(r.usesVividbooks!=="yes"&&r.usesVividbooks!=="no"){f("Vyberte prosím u položky „Používám Vividbooks“ možnost Ano nebo Ne.");return}if(x&&h){const y=r.email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(y)){f("Vyplňte prosím platný e-mail.");return}v(!0),f("");try{if((await(await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/public/webinar-registration-check?webinarId=${encodeURIComponent(String(t.id))}&email=${encodeURIComponent(y)}`,{headers:{Authorization:`Bearer ${fe}`}})).json().catch(()=>({}))).registered){O(!0);return}}catch{f("Nepodařilo se ověřit registraci. Zkuste to prosím znovu.");return}finally{v(!1)}}v(!0),f("");try{const y=await fetch(`https://${je}.supabase.co/functions/v1/make-server-93a20b6f/webinar-registrace`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${fe}`},body:JSON.stringify({webinarId:t.id,webinarTitle:t.title,webinarSlug:t.slug||t.id,webinarDay:t.day,webinarMonthNum:t.monthNum,webinarYear:t.year,webinarTime:t.time,webinarMonthName:t.monthName,mailchimpTagName:t.mailchimpTagName,notTeacher:P,...r})});if(!y.ok){const xe=await y.json().catch(()=>({}));if(y.status===409&&x){O(!0),v(!1);return}throw new Error(xe.error||"Registrace se nepodařila.")}const A=await y.json().catch(()=>({}));typeof A.streamUrl=="string"&&A.streamUrl?ee({streamUrl:A.streamUrl,calendar:A.calendar&&typeof A.calendar.googleUrl=="string"&&typeof A.calendar.outlookUrl=="string"?{googleUrl:A.calendar.googleUrl,outlookUrl:A.calendar.outlookUrl,icsBase64:typeof A.calendar.icsBase64=="string"&&A.calendar.icsBase64?A.calendar.icsBase64:null}:null}):ee(null),x?O(!0):V(!0)}catch(y){console.error("Webinar registration error:",y),f(y.message||"Nastala chyba při odesílání. Zkuste to prosím znovu.")}finally{v(!1)}};return x?I?e.jsxs(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.3},className:"flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#E8EBF4]",children:[e.jsx(Be,{title:`${t.title} — dotazník`,path:`/webinar/${t.id}`,description:`Dotazník po webináři: ${t.title}`,jsonLd:Le({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Ve(`/webinar/${t.id}`)})}),e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-hidden",children:e.jsx(Me,{webinar:t,email:r.email,participantName:r.name,participantBirthDateIso:r.birthDateIso,participantSchoolName:r.schoolName,participantSchoolIco:r.ico.replace(/\D/g,""),onAnswersChange:k,scope:"post",certificateKindOverride:"dvpp",variant:"fullscreen"})})]}):e.jsxs(W.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:{duration:.3},className:"flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#E8EBF4]",children:[e.jsx(Be,{title:`${t.title} — dotazník`,path:`/webinar/${t.id}`,description:`Dotazník po webináři: ${t.title}`,jsonLd:Le({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Ve(`/webinar/${t.id}`)})}),e.jsxs("div",{className:"mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 px-4 py-10 sm:px-6",children:[e.jsx("h1",{className:"text-center font-['Cooper_Light',serif] text-[26px] text-[#001161] sm:text-[30px]",children:"Dotazník po webináři"}),e.jsx("p",{className:"text-center font-['Fenomen_Sans',sans-serif] text-[14px] leading-relaxed text-[#001161]/75",children:"Vyplňte údaje pro uložení odpovědí a certifikát. Poté pokračujte k dotazníku — bez přihlášení."}),e.jsxs("div",{className:"rounded-[28px] border border-[#001161]/10 bg-[#F0F2F8] px-5 py-8 md:px-10",children:[e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"Jméno a příjmení *"}),e.jsx("input",{type:"text",value:r.name,onChange:a=>$e("name",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",placeholder:"Jana Nováková",autoComplete:"name",autoFocus:!0}),e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"E-mail *"}),e.jsx("input",{type:"text",inputMode:"email",autoCapitalize:"none",autoCorrect:"off",spellCheck:!1,value:r.email,onChange:a=>$e("email",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15",placeholder:"vas@email.cz",autoComplete:"email"}),e.jsx("label",{className:"mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]",children:"Datum narození *"}),e.jsx("input",{type:"date",value:r.birthDateIso,onChange:a=>$e("birthDateIso",a.target.value),className:"mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("p",{className:"mb-2 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-wider text-[#001161]/40",children:"Škola (vyhledávání) *"}),e.jsxs("div",{ref:K,className:"relative mb-3",children:[e.jsx("input",{type:"text",value:r.schoolName,onChange:a=>be(a.target.value),onFocus:()=>te.length>0&&se(!0),placeholder:"Název školy",autoComplete:"off",className:"w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("div",{className:"pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30",children:he?e.jsx(pe,{className:"h-4 w-4 animate-spin"}):e.jsx(ut,{className:"h-4 w-4"})}),e.jsx(ke,{children:de&&te.length>0&&e.jsx(W.div,{initial:{opacity:0,y:-6},animate:{opacity:1,y:0},exit:{opacity:0,y:-6},transition:{duration:.15},className:"absolute z-[100] mt-1 max-h-[220px] w-full overflow-y-auto rounded-2xl border border-[#001161]/10 bg-white py-1 shadow-xl",children:te.map((a,y)=>e.jsxs("button",{type:"button",onClick:()=>oe(a),className:"group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0F2F8]",children:[e.jsx(ft,{className:"mt-0.5 h-4 w-4 shrink-0 text-[#001161]/30 transition-colors group-hover:text-[#5B4FD8]"}),e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("p",{className:"truncate font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold leading-tight text-[#001161]",children:a.name}),a.address?e.jsxs("p",{className:"mt-0.5 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40",children:[a.address," · IČO: ",a.ico]}):null]})]},`${a.ico}-${y}`))})})]}),e.jsx("input",{type:"text",inputMode:"numeric",value:r.ico,onChange:a=>re(a.target.value),placeholder:"IČO školy",maxLength:10,className:"mb-5 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"}),e.jsx("button",{type:"button",disabled:!gt,onClick:()=>{Ht({name:r.name,email:r.email,birthDateIso:r.birthDateIso,schoolName:r.schoolName,ico:r.ico}),g(Te()),N(!0)},className:"w-full rounded-[14px] bg-[#001161] py-3.5 font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-white shadow-md transition hover:bg-[#001a8c] disabled:cursor-not-allowed disabled:opacity-50",children:"Pokračovat k dotazníku"})]}),C.length>0&&e.jsxs("div",{className:"mt-1 w-full rounded-[20px] border border-[#001161]/10 bg-white/90 px-4 py-3 shadow-sm",children:[e.jsx("p",{className:"mb-2 font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161]/70",children:"Uložené identity:"}),e.jsx("div",{className:"flex flex-wrap gap-2",children:C.map((a,y)=>e.jsx("button",{type:"button",onClick:()=>X(a),title:`${a.email}
${a.schoolName}${a.ico?` · IČO ${a.ico}`:""}`,className:"inline-flex max-w-full items-center rounded-full border border-[#001161]/15 bg-[#f8f9fc] px-3.5 py-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] transition-colors hover:border-[#5b4fd8]/45 hover:bg-[#fafaff]",children:a.name.trim()||a.email},`${a.savedAt}-${y}`))})]})]})]}):e.jsxs(W.div,{initial:{opacity:0,y:18},animate:{opacity:1,y:0},transition:{duration:.35},className:"min-h-screen bg-white",children:[e.jsx(Be,{title:t.title,path:`/webinar/${t.id}`,description:`DVPP webinář: ${t.title} — ${t.day}. ${t.monthName} ${t.year} v ${t.time}. Online seminář pro učitele zdarma s certifikátem.`,jsonLd:Le({name:t.title,description:t.title,startDate:`${t.year}-${String(t.monthNum||1).padStart(2,"0")}-${String(t.day||1).padStart(2,"0")}T${t.time||"17:00"}:00`,url:Ve(`/webinar/${t.id}`)})}),e.jsx("div",{className:"relative z-30 border-b border-[#001161]/6 bg-white md:sticky md:top-14 md:bg-white/90 md:backdrop-blur-md",children:e.jsx("div",{className:"max-w-[900px] mx-auto px-6 h-14 flex items-center gap-2",children:e.jsxs("button",{onClick:()=>s("/webinare"),className:"flex items-center gap-1.5 text-[#001161]/60 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors cursor-pointer group",children:[e.jsx(Ce,{className:"w-4 h-4 group-hover:-translate-x-0.5 transition-transform"}),"Zobrazit všechny webináře"]})})}),e.jsxs("div",{className:"max-w-[900px] mx-auto px-6 py-10",children:[i&&e.jsxs(W.div,{initial:{opacity:0,y:-10},animate:{opacity:1,y:0},className:"mb-6 flex items-center justify-between gap-4 bg-red-600 rounded-2xl px-6 py-4 shadow-lg shadow-red-600/20",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"flex items-center justify-center w-8 h-8 rounded-full bg-white/20",children:e.jsx(Ie,{className:"w-4 h-4 text-white animate-pulse"})}),e.jsxs("div",{children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] font-bold text-white text-[15px] leading-tight",children:Se>=0?"Webinář právě probíhá!":`Začínáme za ${Math.abs(Math.round(Se))} min`}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-white/70 text-[12px]",children:"Vstupte na živé vysílání a potvrdte svou účast."})]})]}),e.jsx("a",{href:`/webinar/${t.id}/live`,className:"shrink-0 bg-white hover:bg-gray-100 text-red-600 font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-2.5 rounded-full transition-all hover:scale-105 no-underline",children:"Vstoupit na stream →"})]}),e.jsx("div",{className:"flex justify-center mb-10",children:e.jsxs("div",{className:"bg-[#F0F2F8] rounded-[24px] overflow-hidden w-full max-w-[600px]",children:[e.jsx(Pt,{title:t.title,subtitle:t.subtitle,day:t.day,monthName:t.monthName,time:t.time,lecturer:t.lecturer,lecturerAvatar:t.lecturerAvatar,variant:t.thumbnailVariant,coverImage:t.coverImage}),e.jsxs("div",{className:"px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4",children:[e.jsxs("div",{className:"flex flex-col items-center bg-white rounded-[14px] px-4 py-2.5 min-w-[56px] shrink-0",children:[e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] font-black text-[#001158] text-[26px] leading-none",children:t.day}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001158]/60 leading-tight",children:t.monthName}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] font-bold text-[13px] leading-none mt-0.5",style:{color:"#FF8C00"},children:t.time})]}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h1",{className:"font-['Cooper_Light',serif] text-[#001161] text-[24px] md:text-[30px] leading-tight mb-2",children:t.title}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("span",{className:"bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10",children:["Lektoři: ",t.lecturer]}),t.targetAudience&&e.jsx("span",{className:"bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10",children:t.targetAudience})]})]}),!t.isPast&&e.jsxs("div",{className:"shrink-0 flex items-center gap-2",children:[e.jsx("a",{href:"#registrace",className:"bg-[#FF8C00] hover:bg-[#e67d00] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer no-underline shadow-[0_4px_16px_rgba(255,140,0,0.35)]",children:"Přihlásit se"}),(me||i)&&e.jsxs("button",{onClick:()=>s(`/webinar/${t.id}/live`),className:"flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/85 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(0,17,97,0.25)]",children:[e.jsx(Ie,{className:"w-3.5 h-3.5"}),"Otevřít webinář"]})]})]})]})}),e.jsxs("div",{className:"mb-8 max-w-[680px]",children:[e.jsx("div",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] leading-[1.7] font-semibold mb-5 webinar-richtext",dangerouslySetInnerHTML:{__html:t.description}}),t.perks&&e.jsx("div",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[15px] leading-relaxed webinar-richtext",dangerouslySetInnerHTML:{__html:t.perks}})]}),t.isPast&&p.length>0&&S!=="1"&&e.jsxs("div",{className:"mb-10 max-w-[560px] mx-auto",children:[e.jsxs("div",{className:"mb-5 rounded-2xl border border-[#001161]/10 bg-[#F8FAFC] px-5 py-4",children:[e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] mb-2",children:"E-mail pro odeslání odpovědí"}),e.jsx("input",{type:"text",inputMode:"email",autoCapitalize:"none",autoCorrect:"off",spellCheck:!1,value:r.email,onChange:a=>F(y=>({...y,email:a.target.value})),className:"w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 font-['Fenomen_Sans',sans-serif]",placeholder:"vas@email.cz",autoComplete:"email"})]}),e.jsx(Me,{webinar:t,email:r.email,participantName:r.name,onAnswersChange:k,scope:"post"})]}),!t.isPast&&e.jsx("div",{id:"registrace",className:"max-w-[560px] mx-auto",children:e.jsxs("div",{className:"bg-[#F0F2F8] rounded-[28px] px-6 md:px-10 py-8",children:[e.jsx("h2",{className:"font-['Cooper_Light',serif] text-[#001161] text-[28px] text-center mb-6",children:"Přihlaste se na webinář"}),H?e.jsxs(W.div,{initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},className:"flex flex-col items-center text-center py-6 gap-4",children:[e.jsx(dt,{className:"w-14 h-14 text-[#27ae60]"}),e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] font-bold",children:"Děkujeme za vaši registraci"}),e.jsxs("p",{className:"font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[14px] max-w-[360px]",children:[t.day,". ",t.monthName,". ",t.year," v ",t.time," — těšíme se na vaši účast!"]}),e.jsxs("a",{href:G?.streamUrl||ze,className:i?"w-full flex items-center justify-between gap-3 bg-red-600 hover:bg-red-700 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-red-600/20":"w-full flex items-center justify-between gap-3 bg-[#001161] hover:bg-[#001161]/90 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-[#001161]/25",children:[e.jsxs("span",{className:"flex items-center gap-2 text-left",children:[e.jsx(Ie,{className:`w-4 h-4 shrink-0 ${i?"animate-pulse":""}`}),i?"Sledovat webinář live":"Odkaz na živý přenos (v den akce)"]}),e.jsx("span",{className:"text-white/70 text-[12px] font-normal truncate max-w-[160px]",children:(G?.streamUrl||ze).replace(/^https?:\/\//,"")})]}),i?null:e.jsx("p",{className:"font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 max-w-[360px] -mt-2",children:"živý přenos běží až v naplánovaný čas — odkaz si uložte nebo přidejte událost do kalendáře níže."}),e.jsxs("button",{type:"button",onClick:ht,className:"w-full flex items-center justify-center gap-2.5 bg-white border border-[#001161]/12 hover:border-[#001161]/25 hover:bg-[#f0f2f8] text-[#001161] font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all",children:[e.jsx(Qt,{className:"w-5 h-5 shrink-0 text-[#001161]/80"}),"Přidat do kalendáře"]}),e.jsx(Me,{webinar:t,email:r.email,participantName:r.name,onAnswersChange:k,scope:"pre"}),d&&!b?e.jsx(Kt,{form:{name:r.name,email:r.email,phone:r.phone,position:r.position,gdpr:r.gdpr,newsletter:r.newsletter,schoolName:r.schoolName,ico:r.ico},notTeacher:P}):null]}):e.jsx(ws,{form:r,notTeacher:P,onTogglePedagogMode:bt,handleChange:$e,handleSubmit:vt,handleSchoolNameChange:be,handleSchoolSelect:oe,handleIcoChange:re,schoolContainerRef:K,schoolResults:te,schoolOpen:de,setSchoolOpen:se,schoolSearching:he,error:R,submitting:u,positions:ks})]})}),we.length>0&&e.jsxs("div",{className:"mt-16 pb-12",children:[e.jsx("h2",{className:"font-['Cooper_Light',serif] text-[#001161] text-[30px] text-center mb-8",children:"Další nadcházející webináře"}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[700px] mx-auto",children:we.map(a=>e.jsx(Et,{webinar:a},a.id))})]})]})]})}function on(){const{id:t}=Dt(),{webinars:s,loading:o}=ct();if(o)return e.jsxs("div",{className:"flex items-center justify-center gap-3 py-32 text-[#001161]/40",children:[e.jsx(pe,{className:"w-5 h-5 animate-spin"}),e.jsx("span",{className:"font-['Fenomen_Sans',sans-serif] text-[14px]",children:"Načítám..."})]});const m=s.find(l=>l.id===t||l.slug===t);return m?e.jsx(Ss,{webinar:m}):e.jsx($t,{to:"/webinare",replace:!0})}export{on as WebinarDetailRoute};
