import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GenerateBrief() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);
  const [customQuote, setCustomQuote] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [useCustomQuote, setUseCustomQuote] = useState(false);
  const navigate = useNavigate();

  const handleGenerateBrief = async (briefType: 'morning' | 'evening' | 'weekend' | 'sunday_special') => {
    setGenerating(true);
    setProgress('Initializing...');
    
    try {
      console.log(`🚀 Generating ${briefType} brief with Claude AI...`);
      
      // Preflight check: Verify BTC/ETH anchors are fresh
      setProgress('Checking price data freshness...');
      const { data: anchors, error: anchorsError } = await supabase
        .from('live_prices')
        .select('ticker, price, updated_at')
        .in('ticker', ['BTC', 'ETH']);
      
      if (anchorsError) {
        console.warn('⚠️ Could not check price freshness:', anchorsError);
      } else if (anchors) {
        const now = Date.now();
        const staleThreshold = 60 * 60 * 1000; // 60 minutes
        const btc = anchors.find(a => a.ticker === 'BTC');
        const eth = anchors.find(a => a.ticker === 'ETH');
        
        const btcStale = !btc || (now - new Date(btc.updated_at).getTime()) > staleThreshold;
        const ethStale = !eth || (now - new Date(eth.updated_at).getTime()) > staleThreshold;
        
        if (btcStale || ethStale) {
          console.log('⚠️ BTC/ETH prices stale or missing, running sync first...');
          setProgress('Prices stale. Running sync (30s)...');
          
          const { error: syncError } = await supabase.functions.invoke('manual-price-sync');
          
          if (syncError) {
            console.error('❌ Sync failed:', syncError);
            toast.error('Failed to sync prices. Proceeding with stale data...');
          } else {
            console.log('✅ Prices synced successfully');
            toast.success('Prices synced! Generating brief...');
          }
        }
      }
      
      setProgress('Setting up custom quote...');
      // Store custom quote if provided
      if (useCustomQuote && customQuote && customAuthor) {
        await supabase.from('cache_kv').upsert({
          k: 'custom_quote_override',
          v: { quote: customQuote, author: customAuthor },
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        });
        console.log('✅ Custom quote override set');
      }
      
      setProgress('Generating brief with Claude AI (10-20s)...');
      
      const { data, error } = await supabase.functions.invoke('generate-brief-claude', {
        body: { briefType }
      });
      
      if (error) {
        console.error('Brief generation error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('401') || error.message?.includes('Authentication required')) {
          toast.error('Authentication required. Please sign in again.');
          navigate('/auth');
          return;
        }
        
        if (error.message?.includes('403') || error.message?.includes('Admin access required')) {
          toast.error('Admin access required. You do not have permission to generate briefs.');
          return;
        }
        
        toast.error('Failed to generate brief');
        return;
      }
      
      console.log('✅ Brief generated:', data);
      setProgress('Brief generated successfully!');
      
      // Clear custom quote after use
      if (useCustomQuote) {
        setCustomQuote('');
        setCustomAuthor('');
        setUseCustomQuote(false);
      }
      
      // Extract slug from response
      const slug = data?.brief?.slug ?? data?.slug ?? data?.data?.slug;
      
      if (slug) {
        setGeneratedSlug(slug);
      }
      
      // Show success message with navigation options
      const briefTypeLabel = briefType.charAt(0).toUpperCase() + briefType.slice(1);
      toast.success(`${briefTypeLabel} brief generated successfully!`, {
        description: 'Use the buttons below to view the new brief.',
        duration: 10000
      });
      
    } catch (error: any) {
      console.error('❌ Brief generation error:', error);
      
      // Handle specific error codes
      if (error?.status === 401 || error?.status === 403) {
        toast.error('Authentication required. Please log in again.');
      } else if (error?.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error?.message) {
        toast.error(`Generation failed: ${error.message}`);
      } else {
        toast.error('Failed to generate brief. Please try again.');
      }
    } finally {
      setGenerating(false);
      if (!generatedSlug) {
        setProgress('');
      }
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
      <CardHeader>
        <CardTitle>Generate Market Brief with Claude AI</CardTitle>
        <CardDescription>
          Create a new market brief using Claude AI for fast, accurate market analysis
        </CardDescription>
      </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate comprehensive market briefs using Claude AI's fast and accurate analysis.
              Each brief includes market trends, social sentiment, and actionable insights.
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Morning Brief:</strong> Pre-market analysis with opening trends (10-15s)</li>
              <li><strong>Evening Brief:</strong> Market recap with closing analysis (10-15s)</li>
              <li><strong>Weekly Recap:</strong> Comprehensive weekly market summary (15-20s)</li>
              <li><strong>Sunday Special:</strong> Flagship weekly content - investigative, witty, entertaining (15-30s)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Briefs are generated using BTC/ETH price data and saved with a unique slug.
              You'll be automatically redirected to the new brief when complete.
            </p>
            
            <div className="space-y-4 mt-6 p-4 border border-border rounded-lg bg-muted/20">
              <h3 className="font-semibold text-sm">Custom Quote Override (Optional)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Quote Text (max 200 characters)</label>
                  <textarea
                    value={customQuote}
                    onChange={(e) => setCustomQuote(e.target.value)}
                    placeholder="Enter a custom quote for the next brief..."
                    maxLength={200}
                    className="w-full p-2 border border-input rounded-md bg-background text-sm min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{customQuote.length}/200 characters</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Author Name</label>
                  <input
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    placeholder="Author name..."
                    className="w-full p-2 border border-input rounded-md bg-background text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomQuote"
                    checked={useCustomQuote}
                    onChange={(e) => setUseCustomQuote(e.target.checked)}
                    className="rounded border-input"
                  />
                  <label htmlFor="useCustomQuote" className="text-sm cursor-pointer">
                    Use custom quote for next brief
                  </label>
                </div>
              </div>
            </div>
            
            {generating && progress && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border mb-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">{progress}</span>
                </div>
              </div>
            )}
            
            {generatedSlug && !generating && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3">✅ Brief Generated Successfully!</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => navigate(`/marketbrief/${generatedSlug}`)}
                    className="flex-1"
                    variant="default"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View This Brief
                  </Button>
                  <Button 
                    onClick={() => navigate(`/?refresh=${Date.now()}`)}
                    className="flex-1"
                    variant="outline"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Go to Homepage
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The brief has been published and is now live on the homepage.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="grid gap-3">
                <Button 
                  onClick={() => handleGenerateBrief('morning')} 
                  disabled={generating}
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                  size="lg"
                >
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {generating ? progress || 'Generating...' : '🌅 Morning Brief'}
                </Button>
                
                <Button 
                  onClick={() => handleGenerateBrief('evening')} 
                  disabled={generating}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {generating ? progress || 'Generating...' : '🌆 Evening Brief'}
                </Button>
                
                <Button 
                  onClick={() => handleGenerateBrief('weekend')} 
                  disabled={generating}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {generating ? progress || 'Generating...' : '📅 Weekly Recap'}
                </Button>

                <Button 
                  onClick={() => handleGenerateBrief('sunday_special')} 
                  disabled={generating}
                  variant="outline"
                  className="w-full border-2 border-primary"
                  size="lg"
                >
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {generating ? progress || 'Generating...' : '🎬 Sunday Special (Flagship)'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚡ Powered by Claude Sonnet 4.5 - Fast, accurate, and cost-efficient
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Note:</strong> Generation takes 10-20 seconds. You'll be redirected to view the new brief when complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
