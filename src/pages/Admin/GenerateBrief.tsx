import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GenerateBrief() {
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  const handleGenerateBrief = async () => {
    setGenerating(true);
    try {
      console.log('🚀 Generating market brief with Symbol Intelligence Layer...');
      
      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: {}
      });
      
      if (error) {
        console.error('Brief generation error:', error);
        toast.error('Failed to generate brief');
        return;
      }
      
      console.log('✅ Brief generated:', data);
      toast.success('Market brief generated successfully!');
      
      // Navigate to the home page to see the new brief
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Brief generation error:', error);
      toast.error('Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Generate Market Brief</CardTitle>
          <CardDescription>
            Create a new market brief with Symbol Intelligence Layer validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will generate a comprehensive market brief using the Symbol Intelligence Layer for:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Symbol Resolution:</strong> Automatic matching via ticker_mappings → cg_master</li>
              <li><strong>Capability Tagging:</strong> Each symbol tagged with price_ok, tv_ok, derivs_ok, social_ok</li>
              <li><strong>Smart Rendering:</strong> Parentheses only if price_ok, TV charts only if tv_ok</li>
              <li><strong>Cache Warming:</strong> Pre-warms quote cache (120-180s TTL)</li>
              <li><strong>Admin Audit:</strong> Detailed capability report for all symbols</li>
              <li><strong>Auto-Insert:</strong> High-confidence matches (≥0.9) added automatically</li>
              <li><strong>Pending Queue:</strong> Low-confidence matches added to pending_ticker_mappings</li>
            </ul>
            
            <Button 
              onClick={handleGenerateBrief} 
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generating ? 'Generating Brief...' : 'Generate New Market Brief'}
            </Button>
            
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Note:</strong> Generation takes 30-60 seconds. You'll be redirected to view the new brief when complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
