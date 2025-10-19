import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GenerateBrief() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [customQuote, setCustomQuote] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [useCustomQuote, setUseCustomQuote] = useState(false);
  const navigate = useNavigate();

  const handleGenerateBrief = async (briefType: 'morning' | 'evening' | 'weekend', useClaude = false) => {
    setGenerating(true);
    setProgress('Initializing...');
    
    try {
      console.log(`🚀 Generating ${briefType} brief with ${useClaude ? 'Claude AI' : 'Symbol Intelligence Layer'}...`);
      
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
      
      if (useClaude) {
        setProgress('Generating brief with Claude AI (10-20s)...');
      } else {
        setProgress('Collecting market data...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
        setProgress('Generating brief with AI (15-30s)...');
      }
      
      const functionName = useClaude ? 'generate-brief-claude' : 'generate-daily-brief';
      const { data, error } = await supabase.functions.invoke(functionName, {
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
      setProgress('Brief generated! Redirecting...');
      
      // Clear custom quote after use
      if (useCustomQuote) {
        setCustomQuote('');
        setCustomAuthor('');
        setUseCustomQuote(false);
      }
      
      // Extract slug from response to navigate directly to the new brief
      const slug = data?.brief?.slug ?? data?.slug ?? data?.data?.slug;
      
      if (slug) {
        toast.success(`${briefType.charAt(0).toUpperCase() + briefType.slice(1)} brief generated! Opening...`);
        // Navigate directly to the new brief
        setTimeout(() => {
          navigate(`/marketbrief/${slug}`);
        }, 800);
      } else {
        toast.success(`${briefType.charAt(0).toUpperCase() + briefType.slice(1)} brief generated!`);
        // Fallback to home if no slug
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
      
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
      setProgress('');
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
            
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Claude AI (Recommended - Fresh Start)</h3>
                <div className="grid gap-3">
                  <Button 
                    onClick={() => handleGenerateBrief('morning', true)} 
                    disabled={generating}
                    className="w-full bg-gradient-to-r from-primary to-primary/80"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '🤖 Claude Morning Brief'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleGenerateBrief('evening', true)} 
                    disabled={generating}
                    variant="secondary"
                    className="w-full"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '🤖 Claude Evening Brief'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleGenerateBrief('weekend', true)} 
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '🤖 Claude Weekly Recap'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚡ Uses Claude Sonnet 4.5 with minimal data - 10x cheaper, more accurate
                </p>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Legacy System (GPT-4o + Full Data)</h3>
                <div className="grid gap-3">
                  <Button 
                    onClick={() => handleGenerateBrief('morning', false)} 
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '🌅 GPT-4o Morning Brief'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleGenerateBrief('evening', false)} 
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '🌆 GPT-4o Evening Brief'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleGenerateBrief('weekend', false)} 
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {generating ? progress || 'Generating...' : '📅 GPT-4o Weekly Recap'}
                  </Button>
                </div>
              </div>
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
