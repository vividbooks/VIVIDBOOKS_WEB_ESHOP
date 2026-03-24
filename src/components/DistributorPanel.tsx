import { useState, useEffect } from 'react';
import { Download, Copy, ExternalLink, Package, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface DistributorPanelProps {
  onClose: () => void;
}

export function DistributorPanel({ onClose }: DistributorPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [distributorUrl, setDistributorUrl] = useState('');

  useEffect(() => {
    setDistributorUrl(`${window.location.origin}/?view=catalog&mode=distributor`);
  }, []);

  const handleDownloadPack = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/export-distributor-pack`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) throw new Error('Export selhal');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vividbooks_podklady_distributori.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Chyba při generování balíčku. Zkuste to prosím znovu.');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    // Attempt standard clipboard API first if available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        alert('Odkaz byl zkopírován!');
        return;
      } catch (err) {
        // Silently fall through to fallback
      }
    }

    // Fallback for iframe/restricted environments
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        alert('Odkaz byl zkopírován!');
      } else {
        throw new Error('Fallback copy failed');
      }
    } catch (e) {
      // Last resort: prompt user to copy manually
      window.prompt('Odkaz (zkopírujte pomocí Ctrl+C):', text);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-[#001161]">Export pro distributory</h3>
        <p className="text-gray-500">Stáhněte si kompletní podklady nebo nasdílejte speciální náhled katalogu.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Download Box */}
        <div className="bg-white border rounded-3xl p-8 shadow-sm flex flex-col items-center text-center space-y-6">
          <div className="size-16 bg-[#dee4f1] rounded-2xl flex items-center justify-center">
            <Package className="size-8 text-[#001161]" />
          </div>
          <div>
            <h4 className="text-lg font-bold">Kompletní balíček (ZIP)</h4>
            <p className="text-sm text-gray-500 mt-1">Obsahuje fotky, popisky v .txt a přehlednou tabulku .csv</p>
          </div>
          <Button 
            onClick={handleDownloadPack} 
            disabled={isDownloading}
            className="w-full bg-[#001161] hover:bg-[#000a3d] py-6 text-lg rounded-2xl"
          >
            {isDownloading ? (
              <span className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generuji...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="size-5" />
                Stáhnout podklady
              </span>
            )}
          </Button>
        </div>

        {/* Link Box */}
        <div className="bg-[#dee4f1]/30 border border-[#dee4f1] rounded-3xl p-8 flex flex-col items-center text-center space-y-6">
          <div className="size-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <ExternalLink className="size-8 text-[#001161]" />
          </div>
          <div>
            <h4 className="text-lg font-bold">Odkaz pro distributory</h4>
            <p className="text-sm text-gray-500 mt-1">Odkaz na katalog s možností stahovat podklady u každého produktu.</p>
          </div>
          <div className="w-full space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={distributorUrl} className="bg-white border-gray-200" />
              <Button onClick={() => copyToClipboard(distributorUrl)} variant="outline" className="shrink-0">
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-[11px] text-[#001161]/60 italic">* Odkaz je veřejný, můžete jej poslat partnerům.</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <h5 className="font-bold mb-4 flex items-center gap-2">
          <FileText className="size-4" />
          Co balíček obsahuje:
        </h5>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="size-1.5 bg-[#001161] rounded-full" />
            Všechny produktové fotografie
          </div>
          <div className="flex items-center gap-2">
            <div className="size-1.5 bg-[#001161] rounded-full" />
            Popisky sešitů (formát .txt)
          </div>
          <div className="flex items-center gap-2">
            <div className="size-1.5 bg-[#001161] rounded-full" />
            Technické údaje (ISBN, vazba, strany)
          </div>
          <div className="flex items-center gap-2">
            <div className="size-1.5 bg-[#001161] rounded-full" />
            CSV tabulka pro import do e-shopu
          </div>
        </div>
      </div>
    </div>
  );
}