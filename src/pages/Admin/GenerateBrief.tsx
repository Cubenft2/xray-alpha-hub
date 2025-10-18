import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Copy, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toZonedTime, format } from 'date-fns-tz';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Helper: compute deterministic slug for brief
const computeSlug = (briefType: 'morning' | 'evening' | 'weekend'): string => {
  const nyDate = toZonedTime(new Date(), 'America/New_York');
  const dateStr = format(nyDate, 'yyyy-MM-dd');
  return `${briefType}-${dateStr}`;
};

export function GenerateBrief() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [customQuote, setCustomQuote] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [useCustomQuote, setUseCustomQuote] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);
  const [manualTopic, setManualTopic] = useState('');
  const [manualStyle, setManualStyle] = useState('Market Psychologist');
  const navigate = useNavigate();

  // Helper: poll for brief completion
  const pollForBrief = async (slug: string, maxDuration = 120000) => {
    const pollInterval = 2500;
    const startTime = Date.now();
    
    setProgress('Brief is generating in the background...');
    
    const poll = async (): Promise<boolean> => {
      if (Date.now() - startTime > maxDuration) {
        toast.error('Brief generation timed out. Check Market Briefs page in a moment.');
        return false;
      }
      
      const { data, error } = await supabase
        .from('market_briefs')
        .select('slug, is_published')
        .eq('slug', slug)
        .maybeSingle();
      
      if (error) {
        console.error('Polling error:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        return poll();
      }
      
      if (data) {
        console.log('✅ Brief found:', data);
        toast.success('Brief generated! Opening...');
        setTimeout(() => navigate(`/marketbrief/${slug}`), 500);
        return true;
      }
      
      // Not found yet, keep polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      return poll();
    };
    
    return poll();
  };

  const handleGenerateBrief = async (briefType: 'morning' | 'evening' | 'weekend') => {
    setGenerating(true);
    setProgress('Initializing...');
    
    try {
      console.log(`🚀 Generating ${briefType} brief with Symbol Intelligence Layer...`);
      
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
      
      setProgress('Collecting market data...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress('Generating brief with AI...');
      
      // Compute expected slug for polling fallback
      const expectedSlug = computeSlug(briefType);
      
      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: { briefType }
      });
      
      // Clear custom quote after use
      if (useCustomQuote) {
        setCustomQuote('');
        setCustomAuthor('');
        setUseCustomQuote(false);
      }
      
      if (error) {
        console.error('Brief generation error:', error);
        
        // Check if it's a fetch/timeout error (function is still running in background)
        if (error.message?.includes('Failed to fetch') || error.message?.includes('FunctionsFetchError')) {
          console.log('⏳ Connection timeout - brief is generating in background');
          toast.info('Brief is generating in the background. Checking status...');
          await pollForBrief(expectedSlug);
          return;
        }
        
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
      
      // Extract slug from response
      const slug = data?.slug ?? data?.brief?.slug ?? data?.data?.slug;
      
      if (slug) {
        setProgress('Brief generated! Redirecting...');
        toast.success(`${briefType.charAt(0).toUpperCase() + briefType.slice(1)} brief generated!`);
        setTimeout(() => navigate(`/marketbrief/${slug}`), 800);
      } else {
        // No slug in response - start polling with computed slug
        console.log('⏳ No slug in response - polling for completion');
        await pollForBrief(expectedSlug);
      }
      
    } catch (error: any) {
      console.error('❌ Brief generation error:', error);
      
      // Check for connection errors
      if (error?.name === 'FunctionsFetchError' || error?.message?.includes('Failed to fetch')) {
        console.log('⏳ Connection error - brief likely generating in background');
        const expectedSlug = computeSlug(briefType);
        toast.info('Connection timeout. Checking if brief is generating...');
        await pollForBrief(expectedSlug);
        return;
      }
      
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
      setProgress('');
    }
  };

  const handleManualBrief = async () => {
    setManualGenerating(true);
    
    try {
      console.log('📝 Generating manual brief...');
      
      const { data, error } = await supabase.functions.invoke('manual-brief', {
        body: { 
          topic: manualTopic || 'Current crypto market conditions',
          style: manualStyle,
          includeCharts: true
        }
      });
      
      if (error) {
        console.error('Manual brief error:', error);
        toast.error('Failed to generate manual brief');
        return;
      }
      
      if (data?.brief) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.brief);
        toast.success('📋 Brief copied to clipboard!', {
          description: `${data.wordCount} words generated`
        });
        
        // Clear form
        setManualTopic('');
      } else {
        toast.error('No brief content received');
      }
      
    } catch (error: any) {
      console.error('❌ Manual brief error:', error);
      toast.error(`Generation failed: ${error.message || 'Unknown error'}`);
    } finally {
      setManualGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* Manual Brief Generator Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Quick Manual Brief Generator</CardTitle>
          </div>
          <CardDescription>
            Generate a custom brief instantly with AI - perfect for ad-hoc analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-topic">Topic (Optional)</Label>
                <Input
                  id="manual-topic"
                  placeholder="e.g., Bitcoin breaking $100K, Evening market wrap..."
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  disabled={manualGenerating}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-style">Writing Style</Label>
                <select
                  id="manual-style"
                  value={manualStyle}
                  onChange={(e) => setManualStyle(e.target.value)}
                  disabled={manualGenerating}
                  className="w-full p-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="Market Psychologist">Market Psychologist (Educational)</option>
                  <option value="Direct Trader">Direct Trader (Concise)</option>
                  <option value="Data Detective">Data Detective (Analytical)</option>
                </select>
              </div>
            </div>
            
            <Button 
              onClick={handleManualBrief}
              disabled={manualGenerating}
              className="w-full"
              size="lg"
            >
              {manualGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Generate & Copy to Clipboard
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Leave topic blank for a general market brief. Chart links are automatically included.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Automated Brief Generator Card */}
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
            
            <div className="grid gap-3">
              <Button 
                onClick={() => handleGenerateBrief('morning')} 
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generating ? progress || 'Generating...' : '🌅 Generate Morning Brief'}
              </Button>
              
              <Button 
                onClick={() => handleGenerateBrief('evening')} 
                disabled={generating}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generating ? progress || 'Generating...' : '🌆 Generate Evening Brief'}
              </Button>
              
              <Button 
                onClick={() => handleGenerateBrief('weekend')} 
                disabled={generating}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generating ? progress || 'Generating...' : '📅 Generate Weekly Recap'}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Note:</strong> Generation takes 15-30 seconds with the new modular system. You'll be redirected to view the new brief when complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
