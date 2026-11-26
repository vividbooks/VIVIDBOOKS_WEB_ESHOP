/**
 * DVPP TV — prototyp webu (webináře z YouTube, miniaplikace zdarma, BOZP pro sborovnu).
 *
 * Zatím jen na neveřejné adrese DVPPTV_PREVIEW_PATH (noindex, nikde neodkázaná, schválně těžko
 * uhodnutelná). Při změně adresy upravit i hlavičky X-Robots-Tag ve vercel.json.
 *
 * Stránka staví na existující knihovně DVPP zdarma (docs/dvpp): záznamy bere z KV přes
 * DvppVideosContext a přehrává je na /knihovna/zaznam/:id, přihlášení a sborovna jsou
 * /knihovna/prihlaseni a /sborovna. Registrace školy na stránce je jen atrapa — nic neukládá.
 */
export const DVPPTV_PREVIEW_PATH = '/dvpptv-n8w2qe';

/**
 * Upoutávka v hlavičce. Dokud není sestříhaná vlastní (videoId upoutávky na YouTube), hraje se
 * úsek ze záznamu webináře „Jak na slovní úlohy“ (prof. Naďa Vondrová, 30. 9. 2026) od–do v sekundách.
 */
export const DVPPTV_TEASER = {
  videoId: 'lbLf1IsDFJY',
  start: 1328,
  end: 1396,
  title: 'Proč „méně“ neznamená vždycky mínus',
  who: 'prof. Naďa Vondrová, PedF UK · z webináře Jak na slovní úlohy',
  webinarSlug: 'jak-na-slovni-ulohy',
};
