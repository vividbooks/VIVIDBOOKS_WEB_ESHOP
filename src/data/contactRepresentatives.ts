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
    id: 1,
    name: 'Jiří Pabián',
    email: 'jiri@vividbooks.com',
    phone: '+420 606 630 542',
    regions: 'Jihočeský kraj, Plzeňský kraj, Karlovarský kraj, Liberecký kraj, Kraj Vysočina',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/6811b8e537e9180f0677007a_Sni%CC%81mek%20obrazovky%202025-04-30%20v%C2%A07.45.00.png',
  },
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
  {
    id: 6,
    name: 'Albert Dlouhý',
    email: 'albert@vividbooks.cz',
    phone: '+420 736 353 702 (pouze sms)',
    regions: 'Asistent obchodního týmu',
    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/690b392f4f46c83e726f7095_albert.jpg',
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
