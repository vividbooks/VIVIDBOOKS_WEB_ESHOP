import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Trash2, Plus, Edit2, Check, X } from 'lucide-react';

interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  conditionCategories: string[];
  rewardType: string;
  rewardProduct: string | null;
  isActive: boolean;
  createdAt: string;
}

const categories = [
  'Matematika 1. stupeň',
  'Matematika 2. stupeň',
  'Prvouka',
  'Český jazyk',
  'Fyzika',
  'Přírodopis',
  'Chemie'
];

const rewardTypes = [
  { value: 'free_digital', label: 'Digitální učebnice zdarma' },
  { value: 'free_vividboard', label: 'Vividboard zdarma' },
  { value: 'discount', label: 'Sleva' }
];

export function SpecialOffersManager() {
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    conditionType: 'workbook_count',
    conditionValue: 15,
    conditionCategories: [] as string[],
    rewardType: 'free_digital',
    rewardProduct: null,
    isActive: true
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/special-offers`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch offers');

      const data = await response.json();
      setOffers(data.offers || []);
    } catch (error) {
      console.error('Error fetching offers:', error);
      alert('Chyba při načítání nabídek');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/special-offers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) throw new Error('Failed to create offer');

      await fetchOffers();
      resetForm();
      setIsCreating(false);
      alert('Nabídka byla vytvořena!');
    } catch (error) {
      console.error('Error creating offer:', error);
      alert('Chyba při vytváření nabídky');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/special-offers/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) throw new Error('Failed to update offer');

      await fetchOffers();
      setEditingId(null);
      resetForm();
      alert('Nabídka byla aktualizována!');
    } catch (error) {
      console.error('Error updating offer:', error);
      alert('Chyba při aktualizaci nabídky');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tuto nabídku?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/special-offers/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) throw new Error('Failed to delete offer');

      await fetchOffers();
      alert('Nabídka byla smazána!');
    } catch (error) {
      console.error('Error deleting offer:', error);
      alert('Chyba při mazání nabídky');
    }
  };

  const startEdit = (offer: SpecialOffer) => {
    setFormData({
      title: offer.title,
      description: offer.description,
      conditionType: offer.conditionType,
      conditionValue: offer.conditionValue,
      conditionCategories: offer.conditionCategories,
      rewardType: offer.rewardType,
      rewardProduct: offer.rewardProduct,
      isActive: offer.isActive
    });
    setEditingId(offer.id);
    setIsCreating(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      conditionType: 'workbook_count',
      conditionValue: 15,
      conditionCategories: [],
      rewardType: 'free_digital',
      rewardProduct: null,
      isActive: true
    });
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      conditionCategories: prev.conditionCategories.includes(category)
        ? prev.conditionCategories.filter(c => c !== category)
        : [...prev.conditionCategories, category]
    }));
  };

  const handleInitSampleOffers = async () => {
    if (!confirm('Chcete vytvořit vzorové nabídky? (Přepíše existující)')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/init-sample-offers`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) throw new Error('Failed to create sample offers');

      const data = await response.json();
      await fetchOffers();
      alert(data.message);
    } catch (error) {
      console.error('Error creating sample offers:', error);
      alert('Chyba při vytváření vzorových nabídek');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Načítání...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-[#001161] text-[30.95px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.43px]">
          Speciální nabídky
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={handleInitSampleOffers}
            variant="outline"
            className="bg-[#dee4f1] hover:bg-[#c8d4e8] text-[#001161]"
          >
            Vytvořit vzorové nabídky
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsCreating(true);
              setEditingId(null);
            }}
            className="bg-[#ff8c66] hover:bg-[#ff7a4d] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Přidat nabídku
          </Button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-[#f5f7fb] rounded-[24px] p-6 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[#001161] text-[22.92px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.31px]">
              {editingId ? 'Upravit nabídku' : 'Nová nabídka'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                resetForm();
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Název nabídky *</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="např. Digitální učebnice zdarma pro 1. stupeň"
                className="bg-white"
              />
            </div>

            <div>
              <Label>Popis</Label>
              <Input
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="např. Při odběru alespoň 15 ks pracovních sešitů..."
                className="bg-white"
              />
            </div>

            <div>
              <Label>Minimální počet kusů *</Label>
              <Input
                type="number"
                value={formData.conditionValue}
                onChange={e => setFormData(prev => ({ ...prev, conditionValue: parseInt(e.target.value) || 0 }))}
                className="bg-white"
              />
            </div>

            <div>
              <Label className="mb-2 block">Platí pro kategorie *</Label>
              <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded-[6px]">
                {categories.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={formData.conditionCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-[#001161] text-[17px] font-['Fenomen_Sans',sans-serif] cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Typ odměny *</Label>
              <select
                value={formData.rewardType}
                onChange={e => setFormData(prev => ({ ...prev, rewardType: e.target.value }))}
                className="w-full p-2 bg-white border rounded-[6px] text-[#001161] font-['Fenomen_Sans',sans-serif]"
              >
                {rewardTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
              />
              <label htmlFor="isActive" className="text-[#001161] text-[17px] font-['Fenomen_Sans',sans-serif] cursor-pointer">
                Nabídka je aktivní
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                className="bg-[#ff8c66] hover:bg-[#ff7a4d] text-white"
                disabled={!formData.title || formData.conditionCategories.length === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                {editingId ? 'Uložit změny' : 'Vytvořit nabídku'}
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  resetForm();
                }}
                variant="outline"
              >
                Zrušit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Offers List */}
      <div className="space-y-4">
        {offers.length === 0 ? (
          <div className="bg-[#f5f7fb] rounded-[24px] p-8 text-center">
            <p className="text-[#001161] text-[19.797px] font-['Fenomen_Sans',sans-serif] tracking-[-0.267px]">
              Zatím nejsou žádné nabídky. Klikněte na "Přidat nabídku" pro vytvoření první.
            </p>
          </div>
        ) : (
          offers.map(offer => (
            <div
              key={offer.id}
              className={`bg-[#f5f7fb] rounded-[24px] p-6 ${!offer.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[#001161] text-[22.92px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.31px]">
                      {offer.title}
                    </h3>
                    {!offer.isActive && (
                      <span className="text-[#ff8c66] text-[14px] font-['Fenomen_Sans',sans-serif]">
                        (Neaktivní)
                      </span>
                    )}
                  </div>
                  
                  {offer.description && (
                    <p className="text-[#001161] text-[17px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] mb-4">
                      {offer.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 text-[#001161] text-[15px] font-['Fenomen_Sans',sans-serif]">
                    <p>
                      <strong>Podmínka:</strong> Minimálně {offer.conditionValue} ks pracovních sešitů
                    </p>
                    <p>
                      <strong>Kategorie:</strong> {offer.conditionCategories.join(', ')}
                    </p>
                    <p>
                      <strong>Odměna:</strong>{' '}
                      {rewardTypes.find(t => t.value === offer.rewardType)?.label}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(offer)}
                    className="hover:bg-[#dee4f1]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(offer.id)}
                    className="hover:bg-red-100 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}