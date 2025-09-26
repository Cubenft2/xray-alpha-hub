import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, TrendingUp } from 'lucide-react';

export function GenerateBriefNow() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const generateNow = async () => {
    console.log('🐕 XRay: Generating market brief now...');
    setLoading(true);
    
    try {
      // Trigger the news-fetch function which will aggregate news and generate brief
      const { data, error } = await supabase.functions.invoke('news-fetch', {
        body: { 
          limit: 100,
          generate_brief: true,
          session: new Date().getUTCHours() < 15 ? 'premarket' : 'postmarket'
        }
      });

      console.log('🐕 XRay: News-fetch response:', { data, error });

      if (error) {
        console.error('🐕 XRay: Generation error:', error);
        toast({
          title: 'Generation Failed',
          description: error.message || 'Failed to generate market brief',
          variant: 'destructive'
        });
        return;
      }

      setResult(data);
      toast({
        title: 'Brief Generated! 🚀',
        description: 'New market brief created with latest news and crypto charts',
      });

      // Auto-refresh the page after 2 seconds to show new brief
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('🐕 XRay: Generation exception:', error);
      toast({
        title: 'Generation Error',
        description: 'Unexpected error during brief generation',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testCloudflareWorker = async () => {
    console.log('🐕 XRay: Testing Cloudflare worker generation...');
    setLoading(true);
    
    try {
      const workerBase = 'https://crypto-sessions.xray-dog-app.workers.dev/';
      
      const response = await fetch(`${workerBase}marketbrief/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'XRayDog-MarketBrief-Generate/1.0'
        },
        body: JSON.stringify({
          force: true,
          test: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('🐕 XRay: Worker generation result:', result);

      setResult(result);
      toast({
        title: 'Worker Brief Generated! 🎯',
        description: 'Cloudflare worker created a new market brief',
      });

      // Wait a bit then refresh to show the new brief
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('🐕 XRay: Worker generation error:', error);
      toast({
        title: 'Worker Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate via worker',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="xr-card border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="w-5 h-5 mr-2 text-primary" />
          Generate Market Brief Now
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={generateNow}
              disabled={loading}
              className="flex items-center"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              Generate via Supabase
            </Button>
            
            <Button 
              onClick={testCloudflareWorker}
              disabled={loading}
              variant="outline"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Generate via Cloudflare
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Click to create a fresh market brief with the latest crypto news, John Oliver + Joe Rogan style commentary, and live charts for mentioned assets.
          </div>

          {result && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Generation Result:</h4>
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}