import { useState } from 'react';
import { Button } from './ui/button';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export function WebflowDebugPanel() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testWebflow = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/test-webflow`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const data = await response.json();
      console.log('Webflow test results:', data);
      setResult(data);
    } catch (error: any) {
      console.error('Test error:', error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    null
  );
}