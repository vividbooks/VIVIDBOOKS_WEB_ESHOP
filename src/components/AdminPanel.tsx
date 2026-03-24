import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { X, Save, Plus, Trash2, Download, Database, Edit2, AlertCircle, CheckCircle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Product } from '../types/product';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface AdminPanelProps {
  onClose: () => void;
  onProductsChange: () => void;
  onOpenCatalog: () => void;
}

export function AdminPanel({ onClose, onProductsChange, onOpenCatalog }: AdminPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'migration' | 'links'>('editor');

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);
    try {
      const isNew = !editingProduct.id;
      const url = isNew 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products`
        : `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products/${editingProduct.id}`;
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingProduct)
      });
      
      if (response.ok) {
        await fetchProducts();
        onProductsChange();
        // setEditingProduct(null); // Keep it open to see changes or close it? 
        // User might want to stay in editor. Let's keep the alert and refresh.
        alert('Uloženo do Supabase!');
      } else {
        const err = await response.text();
        alert(`Chyba při ukládání: ${err}`);
      }
    } catch (e) {
      console.error('Save error:', e);
      alert('Chyba při ukládání: Síťová chyba');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFixCategories = async () => {
    setIsSaving(true);
    try {
      const subjects = [
        { key: 'matematik', label: 'Matematika' },
        { key: 'fyzik', label: 'Fyzika' },
        { key: 'chemi', label: 'Chemie' },
        { key: 'přírodop', label: 'Přírodopis' },
        { key: 'česk', label: 'Český jazyk' },
        { key: 'písank', label: 'Český jazyk' },
        { key: 'čárank', label: 'Český jazyk' },
        { key: 'čáry máry', label: 'Český jazyk' },
        { key: 'grafomotor', label: 'Český jazyk' },
        { key: 'prvouk', label: 'Prvouka' },
        { key: 'anglič', label: 'Angličtina' },
        { key: 'zeměp', label: 'Zeměpis' },
        { key: 'dějep', label: 'Dějepis' },
      ];

      const updatedProducts = products.map(p => {
        if (p.category === 'Ostatní') {
          const name = (p.name || '').toLowerCase();
          for (const s of subjects) {
            if (name.includes(s.key)) {
              return { ...p, category: s.label };
            }
          }
        }
        return p;
      });

      // Batch save - simplified for this environment
      for (const p of updatedProducts) {
        if (p.category !== products.find(oldP => oldP.id === p.id)?.category) {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products/${p.id}`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(p)
          });
        }
      }

      await fetchProducts();
      onProductsChange();
      alert('Kategorie byly opraveny!');
    } catch (e) {
      alert('Chyba při opravě kategorií');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat ze Supabase?')) return;
    try {
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      await fetchProducts();
      onProductsChange();
    } catch (e) {
      alert('Chyba při mazání');
    }
  };

  const [customIds, setCustomIds] = useState({
    digital: '68fcbc58bae5a1ec053b1c40',
    print: '64135780db7f1b2187727635'
  });

  const handleMigrate = async () => {
    if (!confirm('Tímto přemažete všechna data v Supabase daty z Webflow. Pokračovat?')) return;
    setIsMigrating(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/import-webflow`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          digitalId: customIds.digital,
          printId: customIds.print
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Migrace úspěšná! Staženo ${data.count} produktů.`);
        await fetchProducts();
        onProductsChange();
      } else {
        // Zobrazíme PŘESNOU chybu z Webflow, kterou poslal server
        alert(`CHYBA PŘI MIGRACI:\n\n${data.details || data.error}\n\nPokud vidíte "401/Unauthorized", je problém v tokenu. Pokud "404", je špatné ID kolekce.`);
      }
    } catch (e) {
      alert('Migrace selhala: Síťová chyba');
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100">
        
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="bg-[#04036b] p-2 rounded-xl">
              <Database className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#04036b] font-['Fenomen_Sans']">Správa produktů v Supabase</h2>
              <p className="text-sm text-gray-500">Nativní editor databáze (bez závislosti na Webflow)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="size-6 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-50 border-b">
          <button 
            onClick={() => setActiveTab('editor')}
            className={`px-8 py-4 font-bold transition-all ${activeTab === 'editor' ? 'bg-white border-b-2 border-[#ff8c66] text-[#04036b]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Databázový editor
          </button>
          <button 
            onClick={() => setActiveTab('migration')}
            className={`px-8 py-4 font-bold transition-all ${activeTab === 'migration' ? 'bg-white border-b-2 border-[#ff8c66] text-[#04036b]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Migrace z Webflow
          </button>
          <button 
            onClick={() => setActiveTab('links')}
            className={`px-8 py-4 font-bold transition-all ${activeTab === 'links' ? 'bg-white border-b-2 border-[#ff8c66] text-[#04036b]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Katalog & Odkazy
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'editor' ? (
            <>
              {/* Product List */}
              <div className="w-1/3 border-r overflow-y-auto p-4 bg-gray-50/30">
                <Button 
                  onClick={() => setEditingProduct({ name: '', category: '', type: 'online', price: '0,-' })}
                  className="w-full mb-2 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white rounded-xl h-12 font-bold"
                >
                  <Plus className="mr-2 size-5" /> Přidat nový produkt
                </Button>
                
                <Button 
                  onClick={handleFixCategories}
                  disabled={isSaving}
                  variant="outline"
                  className="w-full mb-4 border-[#04036b] text-[#04036b] hover:bg-blue-50 rounded-xl h-10 font-bold text-xs"
                >
                  <CheckCircle className="mr-2 size-4" /> Opravit kategorie (písanky → ČJ)
                </Button>
                
                {isLoading ? (
                  <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#04036b]"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {products.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => setEditingProduct(p)}
                        className={`p-3 rounded-2xl cursor-pointer border transition-all ${editingProduct?.id === p.id ? 'bg-white border-[#04036b] shadow-md ring-1 ring-[#04036b]' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          {p.image && <img src={p.image} className="size-12 object-cover rounded-lg border" />}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[#04036b] truncate">{p.name}</h4>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-500">{p.category} • {p.price}</p>
                              {(p.note || p.poznamka || p.metadata?.poznamka || p.metadata?.poznámka) && (
                                <span className="text-[10px] bg-[#FF9900] text-white px-2 py-0.5 rounded-full font-bold">
                                  {p.note || p.poznamka || p.metadata?.poznamka || p.metadata?.poznámka}
                                </span>
                              )}
                              {(p.previewLink || p.flipbookLink) && (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">LINK</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit Form */}
              <div className="flex-1 overflow-y-auto p-8 bg-white">
                {editingProduct ? (
                  <form onSubmit={handleSave} className="max-w-2xl space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-[#04036b]">Detail produktu</h3>
                      {editingProduct.id && (
                        <button 
                          type="button"
                          onClick={() => handleDelete(editingProduct.id!)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-bold"
                        >
                          <Trash2 size={16} /> Smazat ze Supabase
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <Label>Název produktu</Label>
                        <Input 
                          value={editingProduct.name || ''} 
                          onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Předmět / Kategorie</Label>
                        <Select 
                          value={editingProduct.category || ''} 
                          onValueChange={v => setEditingProduct({...editingProduct, category: v})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Vyberte předmět" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Matematika 1. stupeň">Matematika 1. stupeň</SelectItem>
                            <SelectItem value="Matematika 2. stupeň">Matematika 2. stupeň</SelectItem>
                            <SelectItem value="Fyzika">Fyzika</SelectItem>
                            <SelectItem value="Chemie">Chemie</SelectItem>
                            <SelectItem value="Přírodopis">Přírodopis</SelectItem>
                            <SelectItem value="Český jazyk">Český jazyk</SelectItem>
                            <SelectItem value="Prvouka">Prvouka</SelectItem>
                            <SelectItem value="Angličtina">Angličtina</SelectItem>
                            <SelectItem value="Zeměpis">Zeměpis</SelectItem>
                            <SelectItem value="Dějepis">Dějepis</SelectItem>
                            <SelectItem value="Ostatní">Ostatní</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Typ produktu</Label>
                        <Select 
                          value={editingProduct.type} 
                          onValueChange={v => setEditingProduct({...editingProduct, type: v as any})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="online">Digitální licence</SelectItem>
                            <SelectItem value="workbook">Pracovní sešit</SelectItem>
                            <SelectItem value="vividboard">Vividboard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Cena (zobrazení)</Label>
                        <Input 
                          value={editingProduct.price || ''} 
                          onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                          className="mt-1"
                          placeholder="390,-"
                        />
                      </div>

                      {editingProduct.type === 'online' && (
                        <div className="col-span-2">
                          <Label>Poznámka (Bobánek)</Label>
                          <Input 
                            value={editingProduct.note || ''} 
                            onChange={e => setEditingProduct({...editingProduct, note: e.target.value, poznamka: e.target.value})}
                            className="mt-1"
                            placeholder="Dostupné v dubnu 2026"
                          />
                        </div>
                      )}

                      <div>
                        <Label>URL obrázku</Label>
                        <Input 
                          value={editingProduct.image || ''} 
                          onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                          className="mt-1"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label>Odkaz na ukázku (Prolistovat)</Label>
                        <Input 
                          value={editingProduct.previewLink || ''} 
                          onChange={e => setEditingProduct({...editingProduct, previewLink: e.target.value, flipbookLink: e.target.value})}
                          className="mt-1"
                          placeholder="https://flipbook.vividbooks.com/..."
                        />
                        <p className="text-[10px] text-gray-400 mt-1 italic">Tento odkaz se načítá z pole "ukázka link" ve Webflow.</p>
                      </div>

                      <div className="col-span-2">
                        <Label>Doložka</Label>
                        <Input 
                          value={editingProduct.dolozka || ''} 
                          onChange={e => setEditingProduct({...editingProduct, dolozka: e.target.value})}
                          className="mt-1"
                          placeholder="Např. schváleno MŠMT č.j. ..."
                        />
                        <p className="text-[10px] text-gray-400 mt-1 italic">Doložka MŠMT nebo jiný schvalovací údaj pro titul.</p>
                      </div>

                      <div className="col-span-2">
                        <Label className="flex items-center gap-2">
                          Obsah sešitu
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">RAG</span>
                        </Label>
                        <textarea
                          value={editingProduct.obsah || ''}
                          onChange={e => setEditingProduct({...editingProduct, obsah: e.target.value})}
                          className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-white min-h-[140px]"
                          placeholder={"Kapitola 1: Přirozená čísla\nKapitola 2: Zlomky\nKapitola 3: Desetinná čísla\n...\n\nNebo volný popis tématu, klíčová slova, typy úloh apod."}
                        />
                        <p className="text-[10px] text-gray-400 mt-1 italic">
                          Obsah nebo tematický přehled sešitu — zobrazuje se pouze v RAG databázi, ne na webu. Pomáhá AI lépe odpovídat na dotazy o obsahu konkrétních titulů.
                        </p>
                      </div>

                      {editingProduct.metadata && (
                        <div className="col-span-2 mt-4">
                          <details className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 border border-dashed">
                            <summary className="cursor-pointer font-bold hover:text-gray-600 transition-colors">
                              Zobrazit kompletní surová data z Webflow (Raw JSON)
                            </summary>
                            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed bg-white p-4 rounded-lg border">
                              {JSON.stringify(editingProduct.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}

                      {editingProduct.type === 'workbook' && (
                        <>
                          <div>
                            <Label>ISBN</Label>
                            <Input 
                              value={editingProduct.isbn || ''} 
                              onChange={e => setEditingProduct({...editingProduct, isbn: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Poznámka (Bobánek)</Label>
                            <Input 
                              value={editingProduct.note || ''} 
                              onChange={e => setEditingProduct({...editingProduct, note: e.target.value, poznamka: e.target.value})}
                              className="mt-1"
                              placeholder="Dostupné v dubnu 2026"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="pt-6 border-t flex gap-4">
                      <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex-1 bg-[#04036b] hover:bg-[#03025a] text-white h-12 rounded-xl font-bold"
                      >
                        <Save className="mr-2" /> Uložit do Supabase
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditingProduct(null)}
                        className="px-8 h-12 rounded-xl border-gray-200"
                      >
                        Zrušit
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Database size={64} className="mb-4 opacity-20" />
                    <p>Vyberte produkt pro úpravu nebo vytvořte nový</p>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'links' ? (
            <div className="p-12 w-full max-w-2xl mx-auto space-y-8">
              <div className="bg-[#dee4f1] p-8 rounded-3xl border border-blue-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="bg-[#04036b] p-3 rounded-2xl">
                    <ExternalLink className="text-white size-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#04036b]">Veřejný Katalog</h3>
                    <p className="text-sm text-blue-800">Náhled ceníku pro školy a partnery</p>
                  </div>
                </div>

                <p className="text-[#04036b] text-sm leading-relaxed">
                  Tento odkaz vede na vizuální verzi ceníku, kterou můžete sdílet s klienty. 
                  Obsahuje interaktivní náhledy, flipbooky a možnost přímé objednávky.
                </p>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-blue-200 flex items-center justify-between gap-4">
                    <code className="text-xs text-blue-600 truncate flex-1">
                      {window.location.origin}/?view=catalog
                    </code>
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?view=catalog`);
                        alert('Odkaz zkopírován!');
                      }}
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-blue-200"
                    >
                      Kopírovat
                    </Button>
                  </div>

                  <Button 
                    onClick={onOpenCatalog}
                    className="w-full bg-[#04036b] hover:bg-[#03025a] text-white h-14 rounded-2xl font-bold text-lg"
                  >
                    Otevřít Katalog v aplikaci
                  </Button>
                </div>
              </div>

              <div className="bg-[#fff3a4] p-8 rounded-3xl border border-yellow-200 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="bg-[#04036b] p-3 rounded-2xl">
                    <Download className="text-white size-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#04036b]">Distributorský mód</h3>
                    <p className="text-sm text-yellow-900">Podklady pro stažení pro partnery</p>
                  </div>
                </div>

                <p className="text-yellow-900 text-sm leading-relaxed">
                  Tento speciální mód umožňuje distributorům hromadně stahovat podklady (obrázky, texty, ISBN) pro import do jejich vlastních e-shopů.
                </p>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-yellow-300 flex items-center justify-between gap-4">
                    <code className="text-xs text-yellow-700 truncate flex-1">
                      {window.location.origin}/?view=catalog&mode=distributor
                    </code>
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?view=catalog&mode=distributor`);
                        alert('Odkaz zkopírován!');
                      }}
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-yellow-300"
                    >
                      Kopírovat
                    </Button>
                  </div>

                  <Button 
                    onClick={() => window.open(`/?view=catalog&mode=distributor`, '_blank')}
                    className="w-full bg-[#04036b] hover:bg-[#03025a] text-white h-14 rounded-2xl font-bold text-lg"
                  >
                    Otevřít v novém okně
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 w-full max-w-2xl mx-auto space-y-8">
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex gap-4">
                <AlertCircle className="text-blue-600 size-8 shrink-0" />
                <div>
                  <h3 className="font-bold text-blue-900 mb-1">Jednorázová migrace</h3>
                  <p className="text-blue-800 text-sm leading-relaxed">
                    Tato funkce slouží k úvodnímu naplnění databáze Supabase daty z vašeho Webflow CMS (kolekce Tiskoviny a Digitální učebnice). 
                    Jakmile data jednou naimportujete, můžete Webflow přestat používat a spravovat vše přímo v tomto editoru.
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h4 className="font-bold text-[#04036b] flex items-center gap-2">
                  <span className="size-2 bg-blue-500 rounded-full animate-pulse"></span>
                  KROK 1: Zadejte správná ID kolekcí z Webflow
                </h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Aktuální ID v polích níže jsou pravděpodobně neplatná (Webflow vrací chybu 404). 
                  Najdete je v URL adrese, když ve Webflow otevřete danou CMS kolekci: 
                  <code className="block mt-1 bg-white p-1 rounded border border-blue-200">.../collection/<b className="text-red-500">660d5...</b></code>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-blue-900">Digitální učebnice ID</Label>
                    <Input 
                      value={customIds.digital} 
                      onChange={e => setCustomIds({...customIds, digital: e.target.value})}
                      className="h-10 bg-white border-blue-200"
                      placeholder="Např. 660d5..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-blue-900">Tiskoviny ID</Label>
                    <Input 
                      value={customIds.print} 
                      onChange={e => setCustomIds({...customIds, print: e.target.value})}
                      className="h-10 bg-white border-blue-200"
                      placeholder="Např. 660d5..."
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={handleMigrate}
                    disabled={isMigrating}
                    className="flex-1 h-16 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-95"
                  >
                    {isMigrating ? 'Migruji data...' : 'SPUSTIT KOPIROVÁNÍ S TĚMITO ID'}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (confirm('Opravdu chcete smazat VŠECHNA data ze Supabase? Akce je nevratná.')) {
                        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/clear-products`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
                        });
                        alert('Databáze vymazána.');
                        fetchProducts();
                      }
                    }}
                    variant="outline"
                    className="h-16 px-6 border-red-200 text-red-500 hover:bg-red-50 rounded-2xl font-bold"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="pt-8 border-t">
                <p className="text-xs text-gray-400 text-center">
                  Po dokončení migrace budou všechna stará data v Supabase nahrazena těmi aktuálními z Webflow.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}