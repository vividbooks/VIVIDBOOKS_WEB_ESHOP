/**
 * Barvy složek v galerii — stejné jako Marketing → Galerie / Image Agent.
 */
export const GALLERY_FOLDER_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Český jazyk': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Matematika: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Matematika 2. stupeň': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
  'Matematika 1. stupeň': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  Chemie: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Fyzika: { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
  Přírodopis: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  Dějepis: { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
  Zeměpis: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  Prvouka: { bg: '#fdf4ff', color: '#7c3aed', border: '#ddd6fe' },
  Webináře: { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0' },
  Blog: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  Novinky: { bg: '#fffbeb', color: '#f59e0b', border: '#fde68a' },
  'Nahrané soubory': { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  Ostatní: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
};

export const defaultGalleryFolderColor = { bg: '#f5f3ff', color: '#7C3AED', border: '#ddd6fe' };

export function getGalleryFolderColor(folderName: string) {
  return GALLERY_FOLDER_COLORS[folderName] || defaultGalleryFolderColor;
}
