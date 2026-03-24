import { useState } from 'react';
import { Button } from './ui/button';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export function WebflowDebug() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testWebflow = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/test-webflow`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      setData(result);
      console.log('Webflow Debug Data:', result);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white p-6 rounded-lg shadow-xl max-w-2xl max-h-[90vh] overflow-auto border-2 border-blue-500">
      <h2 className="mb-4">🔍 Webflow Debug Panel</h2>
      
      <Button onClick={testWebflow} disabled={loading} className="mb-4">
        {loading ? 'Načítám...' : 'Načíst data z Webflow'}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
          <p className="text-red-800">❌ Chyba: {error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="text-green-800">✅ Úspěch!</p>
            <p>Collection ID: <code className="bg-white px-2 py-1 rounded">{data.collectionId || 'N/A'}</code></p>
            <p>Token délka: <strong>{data.tokenLength || 'N/A'}</strong></p>
          </div>

          {data.tests && (
            <div className="space-y-3">
              {/* API v1 Test */}
              {data.tests.v1 && (
                <div className={`border p-4 rounded ${data.tests.v1.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="mb-2">
                    <strong>API v1:</strong> {data.tests.v1.success ? '✅ FUNGUJE' : '❌ NEFUNGUJE'}
                  </p>
                  <p>Status: {data.tests.v1.status}</p>
                  {data.tests.v1.itemCount !== undefined && (
                    <p>Počet položek: <strong>{data.tests.v1.itemCount}</strong></p>
                  )}
                  {data.tests.v1.error && (
                    <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto">{data.tests.v1.error}</pre>
                  )}
                  {data.tests.v1.fieldNames && data.tests.v1.fieldNames.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1">Pole:</p>
                      <div className="flex flex-wrap gap-1">
                        {data.tests.v1.fieldNames.map((field: string) => (
                          <code key={field} className="bg-white px-2 py-1 rounded text-xs">{field}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.tests.v1.firstItem && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">První položka (rozbalit)</summary>
                      <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-64">
                        {JSON.stringify(data.tests.v1.firstItem, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* API v2 Test */}
              {data.tests.v2 && (
                <div className={`border p-4 rounded ${data.tests.v2.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="mb-2">
                    <strong>API v2:</strong> {data.tests.v2.success ? '✅ FUNGUJE' : '❌ NEFUNGUJE'}
                  </p>
                  <p>Status: {data.tests.v2.status}</p>
                  {data.tests.v2.itemCount !== undefined && (
                    <p>Počet položek: <strong>{data.tests.v2.itemCount}</strong></p>
                  )}
                  {data.tests.v2.error && (
                    <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto">{data.tests.v2.error}</pre>
                  )}
                  {data.tests.v2.fieldNames && data.tests.v2.fieldNames.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1">Pole:</p>
                      <div className="flex flex-wrap gap-1">
                        {data.tests.v2.fieldNames.map((field: string) => (
                          <code key={field} className="bg-white px-2 py-1 rounded text-xs">{field}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.tests.v2.firstItem && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">První položka (rozbalit)</summary>
                      <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto max-h-64">
                        {JSON.stringify(data.tests.v2.firstItem, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {data.allFieldNames && data.allFieldNames.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="mb-2">📋 Pole v kolekci:</p>
              <div className="flex flex-wrap gap-2">
                {data.allFieldNames.map((field: string) => (
                  <code key={field} className="bg-white px-2 py-1 rounded text-sm">
                    {field}
                  </code>
                ))}
              </div>
            </div>
          )}

          {data.firstItem && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded">
              <p className="mb-2">📄 První položka (ukázka):</p>
              <div className="bg-white p-3 rounded overflow-x-auto">
                <pre className="text-xs">{JSON.stringify(data.firstItem, null, 2)}</pre>
              </div>
            </div>
          )}

          {data.firstItem?.fieldData && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded">
              <p className="mb-2">🎯 Data první položky:</p>
              <div className="space-y-2">
                {Object.entries(data.firstItem.fieldData).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex gap-2">
                    <code className="bg-white px-2 py-1 rounded text-sm min-w-[150px]">{key}:</code>
                    <span className="bg-white px-2 py-1 rounded text-sm flex-1 truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}