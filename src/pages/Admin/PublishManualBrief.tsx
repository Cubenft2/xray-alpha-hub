import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Trash2, Upload } from 'lucide-react';

export default function PublishManualBrief() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [briefType, setBriefType] = useState('evening');
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const extractAssets = (text: string): string[] => {
    const assets: string[] = [];
    const assetPatterns = [
      { symbol: 'BTC', pattern: /Bitcoin|BTC/i },
      { symbol: 'ETH', pattern: /Ethereum|ETH/i },
      { symbol: 'SOL', pattern: /Solana|SOL/i },
      { symbol: 'ADA', pattern: /Cardano|ADA/i },
      { symbol: 'AVAX', pattern: /Avalanche|AVAX/i },
      { symbol: 'LINK', pattern: /Chainlink|LINK/i },
      { symbol: 'MATIC', pattern: /Polygon|MATIC/i },
      { symbol: 'DOT', pattern: /Polkadot|DOT/i },
      { symbol: 'UNI', pattern: /Uniswap|UNI/i },
      { symbol: 'AAVE', pattern: /Aave|AAVE/i },
    ];
    
    assetPatterns.forEach(({ symbol, pattern }) => {
      if (pattern.test(text) && !assets.includes(symbol)) {
        assets.push(symbol);
      }
    });
    
    return assets.slice(0, 5);
  };

  const extractExecutiveSummary = (text: string): string => {
    const marketOverviewMatch = text.match(/## Market Overview\n\n([\s\S]*?)(?=\n\n##|$)/);
    if (marketOverviewMatch) {
      const firstParagraph = marketOverviewMatch[1].split('\n\n')[0];
      return firstParagraph.substring(0, 300) + '...';
    }
    return text.substring(0, 300) + '...';
  };

  const getWordCount = (): number => {
    return content.trim().split(/\s+/).length;
  };

  const handlePreview = () => {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Preview: ${title || 'Brief'}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
                background: #fff;
              }
              h1 { font-size: 2em; margin-bottom: 0.5em; color: #1a1a1a; }
              h2 { 
                font-size: 1.5em; 
                margin-top: 1.5em; 
                margin-bottom: 0.5em; 
                border-bottom: 2px solid #eee; 
                padding-bottom: 0.3em;
                color: #2a2a2a;
              }
              h3 { font-size: 1.2em; margin-top: 1em; color: #3a3a3a; }
              p { margin: 1em 0; color: #4a4a4a; }
              a { color: #0066cc; text-decoration: none; }
              a:hover { text-decoration: underline; }
              code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
              strong { color: #1a1a1a; }
            </style>
          </head>
          <body>
            <div>${content.split('\n').map(line => {
              if (line.startsWith('# ')) return '<h1>' + line.substring(2) + '</h1>';
              if (line.startsWith('## ')) return '<h2>' + line.substring(3) + '</h2>';
              if (line.startsWith('### ')) return '<h3>' + line.substring(4) + '</h3>';
              if (line.startsWith('**') && line.endsWith('**')) return '<p><strong>' + line.substring(2, line.length - 2) + '</strong></p>';
              if (line.match(/\*\*(.*?)\*\*/)) return '<p>' + line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</p>';
              if (line.startsWith('---')) return '<hr>';
              if (line.trim() === '') return '<br>';
              return '<p>' + line + '</p>';
            }).join('')}</div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      toast({
        title: '❌ No content',
        description: 'Please paste the brief content first',
        variant: 'destructive'
      });
      return;
    }

    setIsPublishing(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const slug = `${today}-${briefType}`;
      const featuredAssets = extractAssets(content);
      const executiveSummary = extractExecutiveSummary(content);
      const wordCount = getWordCount();
      
      const finalTitle = title || 
        `${briefType.charAt(0).toUpperCase() + briefType.slice(1)} Brief - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      
      const { error } = await supabase
        .from('market_briefs')
        .insert({
          slug,
          title: finalTitle,
          brief_type: briefType,
          executive_summary: executiveSummary,
          content_sections: {
            markdown: content,
            html: content
          },
          featured_assets: featuredAssets,
          published_at: new Date().toISOString(),
          word_count: wordCount,
          market_data: {
            published_manually: true,
            published_by: 'admin',
            published_from: 'manual-brief-tool'
          }
        });

      if (error) throw error;

      toast({
        title: '✅ Brief published!',
        description: `Successfully published to /market-brief/${slug}`,
      });

      setContent('');
      setTitle('');
      
      setTimeout(() => {
        navigate(`/market-brief/${slug}`);
      }, 1500);

    } catch (error: any) {
      console.error('Publishing error:', error);
      toast({
        title: '❌ Publishing failed',
        description: error.message || 'Failed to publish brief',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">📝 Publish Manual Brief</h1>
        <p className="text-muted-foreground">
          Get a brief from Claude, paste it here, and publish to your homepage
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Word Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWordCount()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: 1,500-2,200 words
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Featured Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {extractAssets(content).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {extractAssets(content).join(', ') || 'None detected yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Brief Type</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={briefType}
              onChange={(e) => setBriefType(e.target.value)}
              className="w-full p-2 border border-input rounded bg-background text-sm"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="weekend">Weekend</option>
              <option value="special">Special Report</option>
            </select>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold text-sm">
            Title (optional - auto-generated if empty)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Evening Brief - October 17, 2025"
            className="text-lg"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-sm">
            Brief Content (paste from Claude chat)
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the brief markdown here...

# 📊 XRay Crypto Evening Brief
## October 17, 2025 | 6:00 PM EST

---

## Market Overview

Bitcoin (BTC $106,729 -4.5%): ..."
            className="min-h-[500px] font-mono text-sm"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-muted-foreground">
              Supports markdown formatting
            </p>
            <p className="text-sm text-muted-foreground">
              {getWordCount()} words
            </p>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Button 
            onClick={handlePublish} 
            size="lg"
            disabled={isPublishing || !content.trim()}
            className="gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                🚀 Publish to Homepage
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!content.trim()}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            👁️ Preview
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setContent('');
              setTitle('');
            }}
            disabled={!content.trim()}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            🗑️ Clear
          </Button>
        </div>
      </div>

      <Card className="mt-8 bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">📋 How to Use This Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li className="font-semibold">Open your chat with Claude (right here!)</li>
            <li>
              Ask Claude: <code className="bg-background px-2 py-1 rounded border">Make me an evening brief about today's crypto market with chart links</code>
            </li>
            <li>Wait for Claude to generate a complete, professional brief</li>
            <li>
              <strong>Copy</strong> all the markdown text Claude provides
            </li>
            <li>
              <strong>Paste</strong> it into the "Brief Content" box above
            </li>
            <li>Optionally add a custom title (or leave blank for auto-title)</li>
            <li>Select the brief type (Morning, Evening, Weekend, or Special)</li>
            <li>Click <strong>"Preview"</strong> to see how it will look (optional)</li>
            <li>Click <strong>"🚀 Publish to Homepage"</strong> when ready</li>
            <li>
              Done! Your brief is now live!
            </li>
          </ol>

          <div className="mt-4 p-3 bg-background rounded border">
            <p className="font-semibold text-sm mb-2">💡 Pro Tips:</p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Claude briefs are already optimized - just paste and publish!</li>
              <li>• Featured assets are auto-detected (BTC, ETH, SOL, etc.)</li>
              <li>• Chart links are preserved automatically</li>
              <li>• Word count target: 1,500-2,200 words for full brief</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
