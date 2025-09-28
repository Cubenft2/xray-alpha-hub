import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Share, Copy, ExternalLink, TrendingUp, BarChart3, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MiniChart } from '@/components/MiniChart';
import { MarketOverview } from '@/components/MarketOverview';
import { ComprehensiveTopMovers } from '@/components/ComprehensiveTopMovers';
import { SocialSentimentBoard } from '@/components/SocialSentimentBoard';
import { StoicQuote } from '@/components/StoicQuote';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';

interface MarketBrief {
  slug: string;
  date: string;
  title: string;
  summary: string;
  article_html: string;
  last_word?: string;
  social_text?: string;
  sources?: Array<{ url: string; label?: string }>;
  focus_assets?: string[];
  og_image?: string;
  author: string;
  canonical: string;
}

export default function MarketBriefHome() {
  const { date } = useParams();
  const [brief, setBrief] = useState<MarketBrief | null>(null);
  const [briefData, setBriefData] = useState<any>(null); // Store raw database data
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();


  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        console.log('🐕 XRay: Fetching market brief...', date ? `for date: ${date}` : 'latest');
        
        let briefData;
        
        if (date) {
          // If we have a date parameter, fetch that specific brief
          console.log('🐕 XRay: Fetching specific date:', date);
          const { data, error } = await supabase
            .from('market_briefs')
            .select('*')
            .eq('date', date)
            .single();
          
          if (error || !data) {
            console.error('🐕 XRay: Brief fetch failed:', error);
            throw new Error(`Brief for ${date} not found`);
          }
          briefData = data;
        } else {
          // Otherwise fetch the latest brief
          const { data, error } = await supabase
            .from('market_briefs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (error || !data) {
            console.error('🐕 XRay: Brief fetch failed:', error);
            throw new Error('No market briefs available');
          }
          briefData = data;
        }
        
        console.log('🐕 XRay: Brief loaded successfully!', briefData);
        
        // Store the raw database data for market widgets
        setBriefData(briefData);
        
        // If comprehensive market data is missing, auto-generate today's brief (no button)
        if (!(briefData as any)?.content_sections?.market_data && !date) {
          console.log('🛠️ Comprehensive data missing — auto-generating today\'s brief...');
          await generateComprehensiveBrief();
          return; // Wait for reload
        }
        
        // Convert database format to expected format
        const aiText = (briefData as any)?.content_sections?.ai_generated_content as string | undefined;
        const articleHtmlFromAI = aiText
          ? `<p>${aiText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n\n+/g, '</p><p>')
              .replace(/\n/g, '<br/>')
            }</p>`
          : '';

        const brief: MarketBrief = {
          slug: briefData.slug || briefData.date || '',
          date: briefData.published_at ? new Date(briefData.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : (briefData.date || ''),
          title: briefData.title || '',
          summary: briefData.executive_summary || briefData.summary || '',
          article_html: briefData.article_html || articleHtmlFromAI || '',
          last_word: '',
          social_text: '',
          sources: [],
          focus_assets: ['BTC', 'SPX'], // Default assets for now
          og_image: '',
          author: briefData.author || 'Captain XRay',
          canonical: briefData.canonical || window.location.href
        };
        
        setBrief(brief);
        
        if (brief.title) {
          document.title = brief.title + ' — XRayCrypto News';
        }
        
      } catch (error) {
        console.error('🐕 XRay: Brief load failed:', error);
        toast({
          title: "Connection Issue",  
          description: `Can't reach database: ${error}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBrief();
  }, [toast, date]);

  const generateComprehensiveBrief = async () => {
    try {
      setGenerating(true);
      console.log('🚀 Generating comprehensive market brief with API keys...');
      
      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: {}
      });
      
      if (error) {
        console.error('❌ Brief generation failed:', error);
        toast({
          title: "API Error",
          description: `Brief generation failed: ${JSON.stringify(error)}`,
          variant: "destructive"
        });
        throw error;
      }
      
      console.log('✅ Brief generated successfully with data sources:', data?.data_summary);
      toast({
        title: "Success!",
        description: `New brief created with ${data?.data_summary?.coins_analyzed || 0} coins analyzed and ${data?.data_summary?.social_assets || 0} social assets tracked.`,
      });
      
      // Refresh the page after a short delay to load the new brief
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('💥 Brief generation error:', error);
      toast({
        title: "Generation Failed",
        description: `Error: ${error}. Check if API keys are working.`,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleShareX = () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    const shareText = `Let's talk about something.\n\n${brief.title} — ${brief.date}`;
    
    const url = new URL('https://twitter.com/intent/tweet');
    url.searchParams.set('text', shareText);
    url.searchParams.set('url', correctUrl);
    window.open(url.toString(), '_blank', 'noopener');
  };

  const handleCopyLink = async () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    try {
      await navigator.clipboard.writeText(correctUrl);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
      toast({
        title: "Link copied!",
        description: "Brief link copied to clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleNativeShare = async () => {
    if (!brief) return;
    
    // Use the current domain instead of the canonical URL from the API
    const currentDomain = window.location.origin;
    const correctUrl = `${currentDomain}/marketbrief/${brief.slug || brief.date}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: brief.title,
          text: `Let's talk about something.\n\n${brief.summary || brief.title}`,
          url: correctUrl
        });
      } catch (error) {
        console.error('Native share failed:', error);
        // When native share fails, copy link instead
        try {
          await navigator.clipboard.writeText(correctUrl);
          toast({
            title: "Link copied!",
            description: "Share unavailable, but link copied to clipboard.",
          });
        } catch (clipboardError) {
          console.error('Clipboard fallback failed:', clipboardError);
          toast({
            title: "Share failed",
            description: "Please copy the URL manually from your browser.",
            variant: "destructive"
          });
        }
      }
    } else {
      // When native share is not supported, copy link instead
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="xr-card">
            <CardContent className="p-8 text-center">
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
              </div>
              <p className="text-muted-foreground mt-4">Loading latest market brief...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="xr-card">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Brief Unavailable</h2>
              <p className="text-muted-foreground">Couldn't load the market brief. Please try again shortly.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold xr-gradient-text">Market Brief</h1>
          <div className="flex items-center gap-2">
            <Button 
              onClick={generateComprehensiveBrief}
              disabled={generating}
              variant="outline"
              size="sm"
            >
              {generating ? 'Testing APIs...' : '🧪 Test API Integration'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareX}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Share on X
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="w-4 h-4 mr-2" />
              {copiedToClipboard ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleNativeShare}>
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Main Brief Card */}
        <Card className="xr-card overflow-hidden">
          {/* Cover Image */}
          {brief.og_image && (
            <div 
              className={`relative aspect-video w-full bg-gradient-to-br from-primary/10 to-background overflow-hidden ${
                imageLoaded ? 'block' : 'hidden'
              }`}
            >
              <img 
                src={brief.og_image}
                alt={brief.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(false)}
              />
            </div>
          )}

          <CardContent className="p-6 lg:p-8">
            {/* Title and Summary */}
            <div className="space-y-4 mb-6 relative">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight xr-gradient-text xr-xray-glow animate-pulse">
                {brief.title}
              </h2>
              {brief.summary && (
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {brief.summary}
                </p>
              )}
            </div>

            {/* Article Content */}
            <div className="prose prose-invert max-w-none mb-6">
              {!brief.article_html?.toLowerCase().includes("let's talk about something") && (
                <p className="italic text-muted-foreground mb-2">Let's talk about something.</p>
              )}
              <div dangerouslySetInnerHTML={{ __html: brief.article_html }} />
            </div>

            {/* Stoic Quote */}
            {briefData?.stoic_quote && (
              <div className="mb-6">
                <StoicQuote quote={briefData.stoic_quote} />
              </div>
            )}

            {/* Last Word */}
            {brief.last_word && (
              <div className="border-l-4 border-primary pl-4 mb-6">
                <p className="italic text-muted-foreground">
                  {brief.last_word}
                </p>
              </div>
            )}

            {/* Sources */}
            {brief.sources && brief.sources.length > 0 && (
              <details className="mb-6 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Sources
                </summary>
                <ul className="mt-3 space-y-1 pl-4">
                  {brief.sources.map((source, index) => (
                    <li key={index}>
                      <a 
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {source.label || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Market Overview Section */}
            {briefData?.content_sections?.market_data ? (
              <div className="border-t border-border pt-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Market Overview</h3>
                </div>
                <MarketOverview marketData={briefData} />
              </div>
            ) : (
              <div className="border-t border-border pt-6 mb-6">
                <Card className="xr-card">
                  <CardContent className="p-6 text-center">
                    <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Comprehensive Market Data Unavailable</h3>
                    <p className="text-muted-foreground">
                      Preparing today's comprehensive brief... This may take 10–20 seconds.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Movers & Trending Section */}
            {briefData?.content_sections?.market_data && (
              <div className="border-t border-border pt-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Market Movers & Trending</h3>
                </div>
                <ComprehensiveTopMovers marketData={briefData} />
              </div>
            )}

            {/* Social Sentiment Section */}
            {briefData?.content_sections?.market_data && (
              <div className="border-t border-border pt-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Social Sentiment Analysis</h3>
                </div>
                <SocialSentimentBoard marketData={briefData} />
              </div>
            )}

            {/* Market Charts Section */}
            <div className="border-t border-border pt-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Market Focus - Featured Assets</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Always show BTC and ETH */}
                <Card className="h-48">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium mb-2 text-center">Bitcoin (BTC)</div>
                    <div className="h-36">
                      <MiniChart symbol="BTCUSD" theme={theme} />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="h-48">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium mb-2 text-center">Ethereum (ETH)</div>
                    <div className="h-36">
                      <MiniChart symbol="ETHUSD" theme={theme} />
                    </div>
                  </CardContent>
                </Card>

                {/* Dynamic charts based on featured assets */}
                {briefData?.featured_assets?.includes('SOL') && (
                  <Card className="h-48">
                    <CardContent className="p-3">
                      <div className="text-sm font-medium mb-2 text-center">Solana (SOL)</div>
                      <div className="h-36">
                        <MiniChart symbol="SOLUSD" theme={theme} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Add S&P 500 for market context */}
                <Card className="h-48">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium mb-2 text-center">S&P 500</div>
                    <div className="h-36">
                      <MiniChart symbol="SPX" theme={theme} />
                    </div>
                  </CardContent>
                </Card>

                {/* Add DXY when discussing macro */}
                {brief.article_html?.toLowerCase().includes('dollar') && (
                  <Card className="h-48">
                    <CardContent className="p-3">
                      <div className="text-sm font-medium mb-2 text-center">US Dollar Index</div>
                      <div className="h-36">
                        <MiniChart symbol="DXY" theme={theme} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Add Gold when discussing safe havens */}
                {(brief.article_html?.toLowerCase().includes('gold') || brief.article_html?.toLowerCase().includes('safe haven')) && (
                  <Card className="h-48">
                    <CardContent className="p-3">
                      <div className="text-sm font-medium mb-2 text-center">Gold (XAU/USD)</div>
                      <div className="h-36">
                        <MiniChart symbol="XAUUSD" theme={theme} />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Inline Share Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button onClick={handleShareX} size="sm">
                Share on X
              </Button>
              <Button variant="outline" onClick={handleCopyLink} size="sm">
                Copy Link
              </Button>
            </div>
          </CardContent>

          {/* Watermark Footer with Prominent Stamp */}
          <div className="px-6 lg:px-8 pb-6 relative">
            {/* Prominent watermark stamp for sharing */}
            <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
              <img 
                src="/xray-dog.png" 
                alt="XRayCrypto Watermark" 
                className="w-24 h-24 lg:w-32 lg:h-32"
              />
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-accent/20 rounded-lg p-4 relative z-10">
              <div className="flex items-center gap-3">
                <img 
                  src="/pfp.png" 
                  alt="XRayCrypto" 
                  className="w-8 h-8 rounded-md border border-primary/20"
                />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-foreground">© XRayCrypto News</span>
                  <span className="text-xs opacity-80 -mt-0.5 ml-4">xraycrypto.io</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-foreground">{brief.date}</div>
                <div className="text-xs opacity-80">Market Brief</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
