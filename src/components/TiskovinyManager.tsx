import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tiskovina } from '../types/tiskovina';

export function TiskovinyManager() {
  const [tiskoviny, setTiskoviny] = useState<Tiskovina[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTiskovina, setEditingTiskovina] = useState<Tiskovina | null>(null);
  const [filterPredmet, setFilterPredmet] = useState<string>('all');
  const [filterTyp, setFilterTyp] = useState<string>('all');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    predmet: '',
    typTiskoviny: '',
    cena: 0,
    isbn: '',
    ean: '',
    format: '',
    vazba: '',
    pocetStranek: 0,
    rokVydani: '',
    autori: '',
    popis: '',
    eshopLink: '',
    ukazkaLink: '',
    dolozka: '',
    poznamka: ''
  });

  const fetchTiskoviny = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/tiskoviny`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch tiskoviny');
      }
      
      const data = await response.json();
      setTiskoviny(data.tiskoviny || []);
    } catch (error) {
      console.error('Error fetching tiskoviny:', error);
      alert('Chyba při načítání tiskovin');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTiskoviny();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Vyplňte prosím název');
      return;
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/tiskoviny`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to save tiskovina');
      }
      
      await fetchTiskoviny();
      resetForm();
      alert('✅ Tiskovina byla úspěšně přidána do Webflow!');
    } catch (error) {
      console.error('Error saving tiskovina:', error);
      alert(`Chyba při ukládání tiskoviny: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tuto tiskovinu z Webflow?')) {
      return;
    }
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/tiskoviny/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to delete tiskovina');
      }
      
      await fetchTiskoviny();
      alert('✅ Tiskovina byla smazána z Webflow');
    } catch (error) {
      console.error('Error deleting tiskovina:', error);
      alert('Chyba při mazání tiskoviny');
    }
  };

  const handleEdit = (tiskovina: Tiskovina) => {
    setEditingTiskovina(tiskovina);
    setFormData({
      name: tiskovina.name,
      predmet: tiskovina.predmet || '',
      typTiskoviny: tiskovina.typTiskoviny || '',
      cena: tiskovina.cena || 0,
      isbn: tiskovina.isbn || '',
      ean: tiskovina.ean || '',
      format: tiskovina.format || '',
      vazba: tiskovina.vazba || '',
      pocetStranek: tiskovina.pocetStranek || 0,
      rokVydani: tiskovina.rokVydani || '',
      autori: tiskovina.autori || '',
      popis: tiskovina.popis || '',
      eshopLink: tiskovina.eshopLink || '',
      ukazkaLink: tiskovina.ukazkaLink || '',
      dolozka: tiskovina.dolozka || '',
      poznamka: tiskovina.poznamka || ''
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      predmet: '',
      typTiskoviny: '',
      cena: 0,
      isbn: '',
      ean: '',
      format: '',
      vazba: '',
      pocetStranek: 0,
      rokVydani: '',
      autori: '',
      popis: '',
      eshopLink: '',
      ukazkaLink: '',
      dolozka: '',
      poznamka: ''
    });
    setEditingTiskovina(null);
  };

  const filteredTiskoviny = tiskoviny.filter(t => {
    const predmetName = t.predmet;
    const typName = t.typTiskoviny;
    
    if (filterPredmet !== 'all' && predmetName !== filterPredmet) return false;
    if (filterTyp !== 'all' && typName !== filterTyp) return false;
    return true;
  });

  // Get unique values for filters from actual data
  const uniquePredmety = Array.from(new Set(tiskoviny.map(t => t.predmet).filter(Boolean)));
  const uniqueTypy = Array.from(new Set(tiskoviny.map(t => t.typTiskoviny).filter(Boolean)));

  const handleMigrate = async () => {
    if (!confirm(`Opravdu chcete přemigrovat všechny tiskoviny (${tiskoviny.length} položek) do kolekce Products jako pracovní sešity?`)) {
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/migrate-tiskoviny`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Migration failed');
      }

      const result = await response.json();
      setMigrationResult(result);
      alert(`✅ ${result.message}\n\nÚspěšně: ${result.successCount}\nChyb: ${result.errorCount}`);
    } catch (error) {
      console.error('Migration error:', error);
      alert('❌ Chyba při migraci tiskovin');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Migration Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="mb-1">📦 Migrace tiskovin do Products</h3>
            <p className="text-sm text-gray-700">
              Přemigrujte všechny tiskoviny ({tiskoviny.length}) do kolekce Products jako pracovní sešity
            </p>
            {migrationResult && (
              <div className="mt-2 text-sm">
                <span className="text-green-600">✓ {migrationResult.successCount} úspěšně</span>
                {migrationResult.errorCount > 0 && (
                  <span className="text-red-600 ml-3">✗ {migrationResult.errorCount} chyb</span>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={handleMigrate}
            disabled={isMigrating || tiskoviny.length === 0}
            className="ml-4"
          >
            {isMigrating ? (
              <>Migruji...</>
            ) : (
              <>
                <ArrowRight className="size-4 mr-2" />
                Migrovat do Products
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left Column - Tiskoviny List */}
        <div className="w-1/2">
          <div className="mb-4">
            <h3 className="text-xl mb-4">Tiskoviny z Webflow ({filteredTiskoviny.length})</h3>
            
            <Button 
              onClick={resetForm}
              className="w-full mb-4"
            >
              <Plus className="size-4 mr-2" />
              Přidat novou tiskovinu do Webflow
            </Button>

            {/* Filtry */}
            <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm">Filtr podle předmětu</Label>
                <select
                  value={filterPredmet}
                  onChange={(e) => setFilterPredmet(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                >
                  <option value="all">Všechny předměty</option>
                  {uniquePredmety.map(predmet => (
                    <option key={predmet} value={predmet}>{predmet}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm">Filtr podle typu</Label>
                <select
                  value={filterTyp}
                  onChange={(e) => setFilterTyp(e.target.value)}
                  className="w-full p-2 border rounded mt-1"
                >
                  <option value="all">Všechny typy</option>
                  {uniqueTypy.map(typ => (
                    <option key={typ} value={typ}>{typ}</option>
                  ))}
                </select>
              </div>

              {(filterPredmet !== 'all' || filterTyp !== 'all') && (
                <Button
                  onClick={() => {
                    setFilterPredmet('all');
                    setFilterTyp('all');
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Zrušit filtry
                </Button>
              )}
            </div>
          </div>
          
          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Načítám tiskoviny z Webflow...</p>
          ) : (
            <div className="space-y-2 max-h-[calc(90vh-250px)] overflow-y-auto pr-2">
              {filteredTiskoviny.map((tiskovina) => (
                <div
                  key={tiskovina.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    editingTiskovina?.id === tiskovina.id
                      ? 'bg-[#dee4f1] border-[#04036b]'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleEdit(tiskovina)}
                >
                  <div className="flex items-center gap-3">
                    {tiskovina.coverImage && (
                      <div className="flex-shrink-0 w-16 h-20 bg-gray-100 rounded overflow-hidden">
                        <img 
                          src={tiskovina.coverImage} 
                          alt={tiskovina.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate">{tiskovina.name}</h4>
                      <p className="text-sm text-gray-600 truncate">
                        {tiskovina.predmet} · {tiskovina.typTiskoviny || 'Bez typu'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tiskovina.cena ? `${tiskovina.cena} Kč` : 'Bez ceny'}
                        {tiskovina.isbn ? ` · ISBN: ${tiskovina.isbn}` : ''}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tiskovina.id);
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {filteredTiskoviny.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  {tiskoviny.length === 0 
                    ? 'Zatím žádné tiskoviny ve Webflow. Přidejte první!'
                    : 'Žádné tiskoviny nevyhovují filtru.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Tiskovina Form */}
        <div className="w-1/2 border-l pl-6">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl">
                {editingTiskovina ? 'Detail tiskoviny' : 'Nová tiskovina'}
              </h3>
              {editingTiskovina && (
                <Button onClick={resetForm} variant="outline" size="sm">
                  Zrušit
                </Button>
              )}
            </div>

            {editingTiskovina ? (
              <div className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
                <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ Tato tiskovina je uložena ve Webflow. Úpravy zatím nejsou podporovány - můžete ji pouze smazat.
                  </p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <p><strong>Název:</strong> {editingTiskovina.name}</p>
                  {editingTiskovina.predmet && <p><strong>Předmět:</strong> {editingTiskovina.predmet}</p>}
                  {editingTiskovina.typTiskoviny && <p><strong>Typ:</strong> {editingTiskovina.typTiskoviny}</p>}
                  {editingTiskovina.cena && <p><strong>Cena:</strong> {editingTiskovina.cena} Kč</p>}
                  {editingTiskovina.isbn && <p><strong>ISBN:</strong> {editingTiskovina.isbn}</p>}
                  {editingTiskovina.ean && <p><strong>EAN:</strong> {editingTiskovina.ean}</p>}
                  {editingTiskovina.format && <p><strong>Formát:</strong> {editingTiskovina.format}</p>}
                  {editingTiskovina.vazba && <p><strong>Vazba:</strong> {editingTiskovina.vazba}</p>}
                  {editingTiskovina.pocetStranek && <p><strong>Počet stránek:</strong> {editingTiskovina.pocetStranek}</p>}
                  {editingTiskovina.rokVydani && <p><strong>Rok vydání:</strong> {editingTiskovina.rokVydani}</p>}
                  {editingTiskovina.autori && <p><strong>Autoři:</strong> {editingTiskovina.autori}</p>}
                  {editingTiskovina.popis && (
                    <div>
                      <strong>Popis:</strong>
                      <p className="mt-1 text-gray-700">{editingTiskovina.popis}</p>
                    </div>
                  )}
                  {editingTiskovina.eshopLink && (
                    <p><strong>E-shop link:</strong> <a href={editingTiskovina.eshopLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{editingTiskovina.eshopLink}</a></p>
                  )}
                  {editingTiskovina.ukazkaLink && (
                    <p><strong>Ukázka link:</strong> <a href={editingTiskovina.ukazkaLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{editingTiskovina.ukazkaLink}</a></p>
                  )}
                  {editingTiskovina.dolozka && <p><strong>Doložka MŠMT:</strong> {editingTiskovina.dolozka}</p>}
                  {editingTiskovina.poznamka && <p><strong>Poznámka:</strong> {editingTiskovina.poznamka}</p>}
                  <p className="pt-2"><strong>Webflow ID:</strong> <span className="font-mono text-xs">{editingTiskovina.id}</span></p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
                <div>
                  <Label htmlFor="name">Název *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="např. Matematika 6 - Pracovní sešit"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="predmet">Předmět</Label>
                    <Input
                      id="predmet"
                      value={formData.predmet}
                      onChange={(e) => setFormData({ ...formData, predmet: e.target.value })}
                      placeholder="Matematika"
                    />
                  </div>

                  <div>
                    <Label htmlFor="typTiskoviny">Typ tiskoviny</Label>
                    <Input
                      id="typTiskoviny"
                      value={formData.typTiskoviny}
                      onChange={(e) => setFormData({ ...formData, typTiskoviny: e.target.value })}
                      placeholder="Pracovní sešit"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cena">Cena (Kč)</Label>
                    <Input
                      id="cena"
                      type="number"
                      value={formData.cena}
                      onChange={(e) => setFormData({ ...formData, cena: parseInt(e.target.value) || 0 })}
                      placeholder="125"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rokVydani">Rok vydání</Label>
                    <Input
                      id="rokVydani"
                      value={formData.rokVydani}
                      onChange={(e) => setFormData({ ...formData, rokVydani: e.target.value })}
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="isbn">ISBN</Label>
                    <Input
                      id="isbn"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      placeholder="978-80-..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="ean">EAN</Label>
                    <Input
                      id="ean"
                      value={formData.ean}
                      onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                      placeholder="EAN kód"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="format">Formát</Label>
                    <Input
                      id="format"
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      placeholder="A4"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vazba">Vazba</Label>
                    <Input
                      id="vazba"
                      value={formData.vazba}
                      onChange={(e) => setFormData({ ...formData, vazba: e.target.value })}
                      placeholder="měkká"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pocetStranek">Počet stran</Label>
                    <Input
                      id="pocetStranek"
                      type="number"
                      value={formData.pocetStranek}
                      onChange={(e) => setFormData({ ...formData, pocetStranek: parseInt(e.target.value) || 0 })}
                      placeholder="64"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="autori">Autoři</Label>
                  <Input
                    id="autori"
                    value={formData.autori}
                    onChange={(e) => setFormData({ ...formData, autori: e.target.value })}
                    placeholder="Jméno autora"
                  />
                </div>

                <div>
                  <Label htmlFor="popis">Popis</Label>
                  <Textarea
                    id="popis"
                    value={formData.popis}
                    onChange={(e) => setFormData({ ...formData, popis: e.target.value })}
                    placeholder="Detailní popis tiskoviny..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="eshopLink">Link do e-shopu</Label>
                  <Input
                    id="eshopLink"
                    type="url"
                    value={formData.eshopLink}
                    onChange={(e) => setFormData({ ...formData, eshopLink: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="ukazkaLink">Link na ukázku</Label>
                  <Input
                    id="ukazkaLink"
                    type="url"
                    value={formData.ukazkaLink}
                    onChange={(e) => setFormData({ ...formData, ukazkaLink: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="dolozka">Doložka MŠMT</Label>
                  <Input
                    id="dolozka"
                    value={formData.dolozka}
                    onChange={(e) => setFormData({ ...formData, dolozka: e.target.value })}
                    placeholder="Číslo doložky"
                  />
                </div>

                <div>
                  <Label htmlFor="poznamka">Poznámka</Label>
                  <Textarea
                    id="poznamka"
                    value={formData.poznamka}
                    onChange={(e) => setFormData({ ...formData, poznamka: e.target.value })}
                    placeholder="Interní poznámka..."
                    rows={2}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Přidat do Webflow
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}