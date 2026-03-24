import { useState } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { X } from 'lucide-react';

export function TokenUploader() {
  const [token, setToken] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const uploadToken = async () => {
    if (!token.trim()) {
      setMessage('❌ Zadejte token');
      return;
    }

    setIsUploading(true);
    setMessage('Nahrávám...');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/set-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      setMessage('✅ Token úspěšně nahrán! Můžete zavřít toto okno.');
      setToken('');
    } catch (err: any) {
      setMessage(`❌ Chyba: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={() => setIsVisible(false)}
        >
          <X size={20} />
        </button>

        <h2 className="mb-4">🔑 Nahrát Webflow API Token</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm">Webflow API Token:</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Vložte váš Webflow API token..."
              className="w-full font-mono text-sm"
            />
          </div>

          <button 
            onClick={uploadToken} 
            disabled={isUploading || !token.trim()}
            className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded"
          >
            {isUploading ? 'Nahrávám...' : 'Nahrát Token'}
          </button>

          {message && (
            <div className={`p-3 rounded text-sm ${
              message.includes('✅') ? 'bg-green-50 text-green-800' : 
              message.includes('❌') ? 'bg-red-50 text-red-800' : 
              'bg-blue-50 text-blue-800'
            }`}>
              {message}
            </div>
          )}

          <p className="text-xs text-gray-600">
            Token by měl vypadat jako: 7d0575ff912bd6c266716b85b9ff5239f91d52952515a15f4902130e0d0f9341
          </p>
        </div>
      </div>
    </div>
  );
}