import { LayoutGrid, LayoutList } from 'lucide-react';

interface LayoutToggleProps {
  layout: 'horizontal' | 'sidebar';
  onToggle: (layout: 'horizontal' | 'sidebar') => void;
}

export function LayoutToggle({ layout, onToggle }: LayoutToggleProps) {
  return (
    <div className="fixed top-4 left-4 z-40 bg-white rounded-full shadow-lg border-2 border-[#dee4f1] overflow-hidden flex">
      <button
        onClick={() => onToggle('horizontal')}
        className={`p-3 transition-colors ${
          layout === 'horizontal'
            ? 'bg-[#04036b] text-white'
            : 'bg-white text-[#04036b] hover:bg-[#f5f5f5]'
        }`}
        title="Horizontální layout"
      >
        <LayoutGrid className="size-5" />
      </button>
      <button
        onClick={() => onToggle('sidebar')}
        className={`p-3 transition-colors ${
          layout === 'sidebar'
            ? 'bg-[#04036b] text-white'
            : 'bg-white text-[#04036b] hover:bg-[#f5f5f5]'
        }`}
        title="Sidebar layout"
      >
        <LayoutList className="size-5" />
      </button>
    </div>
  );
}
