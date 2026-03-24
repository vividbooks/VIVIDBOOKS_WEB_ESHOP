import { createContext, useContext } from 'react';

export interface CatalogContextType {
  groupingMode: 'grade' | 'subject';
  setGroupingMode: (m: 'grade' | 'subject') => void;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
  scrollToSection: (id: string) => void;
  isDistributorMode: boolean;
  handleDownloadPack: () => void;
  isDownloadingPack: boolean;
}

export const CatalogContext = createContext<CatalogContextType>({
  groupingMode: 'subject',
  setGroupingMode: () => {},
  activeSection: null,
  setActiveSection: () => {},
  scrollToSection: () => {},
  isDistributorMode: false,
  handleDownloadPack: () => {},
  isDownloadingPack: false,
});

export const useCatalog = () => useContext(CatalogContext);
