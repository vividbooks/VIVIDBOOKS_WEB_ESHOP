export type ContactRepresentative = {
  id: number;
  name: string;
  email: string;
  phone: string;
  regions: string;
  photo: string;
};

export const CONTACT_REPRESENTATIVES: ContactRepresentative[] = [
  {
    id: 2,
    name: 'Iveta Fišerová',
    email: 'iveta@vividbooks.com',
    phone: '+420 774 935 055',
    regions: 'Hlavní město Praha, Středočeský kraj, Ústecký kraj, Královéhradecký kraj, Pardubický kraj',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f591597464fe410a0_obchodni-zastupce-vividbooks-iveta-fiserova.webp',
  },
  {
    id: 3,
    name: 'Eva Bukolská',
    email: 'eva.b@vividbooks.com',
    phone: '+420 775 195 709',
    regions: 'Jihomoravský kraj, Olomoucký kraj, Zlínský kraj, Moravskoslezský kraj',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0fed611ead6c658025_obchodni-zastupce-vividbooks-eva-bukolska.webp',
  },
  {
    id: 4,
    name: 'Eduard Malachovský',
    email: 'eduard@vividbooks.com',
    phone: '+421 903 655 622',
    regions: 'Slovensko',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f6373773f769b3a3b_obchodni-zastupce-vividbooks-eduard-malachovsky.webp',
  },
  {
    id: 5,
    name: 'Gabriela Švédová',
    email: 'gabriela@vividbooks.com',
    phone: '+420 605 870 896',
    regions: 'Podpora zákazníků',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/68499506e61fe43631528e42_gabriela-vividbooks.avif',
  },
];

function normalizeRepresentativeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function findContactRepresentative(params: { email?: string | null; name?: string | null }) {
  const normalizedEmail = normalizeRepresentativeText(params.email || '');
  const normalizedName = normalizeRepresentativeText(params.name || '');

  return CONTACT_REPRESENTATIVES.find((rep) => normalizeRepresentativeText(rep.email) === normalizedEmail)
    || CONTACT_REPRESENTATIVES.find((rep) => normalizeRepresentativeText(rep.name) === normalizedName)
    || null;
}
