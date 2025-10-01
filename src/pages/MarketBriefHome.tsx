import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Share, Copy, ExternalLink, TrendingUp, BarChart3, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useTickerMappings } from '@/hooks/useTickerMappings';
import { MiniChart } from '@/components/MiniChart';
import { MarketOverview } from '@/components/MarketOverview';
import { EnhancedBriefRenderer } from '@/components/EnhancedBriefRenderer';
import { ComprehensiveTopMovers } from '@/components/ComprehensiveTopMovers';
import { SocialSentimentBoard } from '@/components/SocialSentimentBoard';
import { StoicQuote } from '@/components/StoicQuote';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

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
  const [extractedTickers, setExtractedTickers] = useState<string[]>([]);
  const [quotesTimestamp, setQuotesTimestamp] = useState<string | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();

  // Get ticker mappings from database
  const { getMapping } = useTickerMappings();

  // Get live prices for all tickers (including top 50 cryptos)
  const allTickers = [
    ...extractedTickers, 
    'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'USDC', 'XRP', 'ADA', 'AVAX', 'DOGE',
    'TRX', 'TON', 'LINK', 'SHIB', 'DOT', 'MATIC', 'UNI', 'LTC', 'BCH', 'NEAR',
    'ICP', 'APT', 'FIL', 'ARB', 'OP', 'HBAR', 'VET', 'MKR', 'ATOM', 'IMX',
    'RNDR', 'STX', 'INJ', 'GRT', 'RUNE', 'FTM', 'ALGO', 'SAND', 'MANA', 'AAVE',
    'EOS', 'XTZ', 'THETA', 'FLR', 'AXS', 'FLOW', 'SUI', 'HYPE', 'ASTER'
  ];
  const { prices: livePrices, loading: pricesLoading } = useLivePrices(allTickers);

  // Fetch quotes timestamp from API
  useEffect(() => {
    const fetchQuotesTimestamp = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('quotes', {
          body: { symbols: ['BTC'] } // Just fetch one symbol to get timestamp
        });
        
        if (!error && data?.timestamp) {
          setQuotesTimestamp(data.timestamp);
        }
      } catch (error) {
        console.error('Failed to fetch quotes timestamp:', error);
      }
    };
    
    fetchQuotesTimestamp();
  }, []);

  // Function to map ticker symbols to TradingView format for charts
  // Uses database mappings to ensure correct chart display
  const mapTickerToTradingView = (ticker: string): { symbol: string; displayName: string; tvOk?: boolean } => {
    const upperTicker = ticker.toUpperCase().trim();
    
    // Try to get from database mappings first
    const mapping = getMapping(upperTicker);
    if (mapping) {
      return {
        symbol: mapping.tradingview_symbol,
        displayName: mapping.display_name,
        tvOk: mapping.tradingview_supported !== false
      };
    }
    
    // If not found, log a warning
    console.warn(`⚠️ TICKER NOT FOUND: "${ticker}" - This may cause incorrect chart display.`);
    
    // Fallback: Try to detect if it's likely a stock or crypto
    // Most stock tickers are 1-4 letters, crypto can be longer
    if (upperTicker.length <= 4 && /^[A-Z]+$/.test(upperTicker)) {
      // Likely a stock - default to NASDAQ (most common for tech/crypto stocks)
      console.warn(`⚠️ Assuming "${upperTicker}" is NASDAQ stock - verify this is correct!`);
      return {
        symbol: `NASDAQ:${upperTicker}`,
        displayName: `${upperTicker}`,
        tvOk: false
      };
    }
    
    // Default to crypto format as last resort
    console.warn(`⚠️ Assuming "${upperTicker}" is crypto - verify this is correct!`);
    return {
      symbol: `${upperTicker}USD`,
      displayName: `${upperTicker}`,
      tvOk: false
    };
  };

  const handleTickersExtracted = (tickers: string[]) => {
    // Filter out common featured assets and duplicates
    const filteredTickers = tickers.filter(ticker => 
      !['BTC', 'BITCOIN', 'ETH', 'ETHEREUM', 'SPX', 'DXY', 'XAUUSD', 'GOLD'].includes(ticker.toUpperCase())
    );
    setExtractedTickers([...new Set(filteredTickers)]);
  };


  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        console.log('🐕 XRay: Fetching market brief...', date ? `for date: ${date}` : 'latest');
        
        let briefData;
        
        if (date) {
          // If we have a date parameter, fetch that specific brief
          console.log('🐕 XRay: Fetching specific date:', date);
          // @ts-ignore - TypeScript type inference issue with Supabase types
          const { data, error } = await supabase
            .from('market_briefs')
            .select('slug, title, executive_summary, content_sections, featured_assets, social_data, market_data, stoic_quote, sentiment_score, published_at, created_at')
            .eq('slug', date)
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
          console.log('🛠️ Comprehensive data missing — creating fresh brief...');
          await generateFreshBrief();
          return; // Wait for reload
        }
        // If an admin audit block accidentally leaked into the article, regenerate a clean brief (no button)
        if (!date) {
          const aiTextRaw = (briefData as any)?.content_sections?.ai_generated_content as string | undefined;
          const articleHtmlRaw = (briefData as any)?.article_html as string | undefined;
          const hasAdminLeak =
            (aiTextRaw && aiTextRaw.includes('[ADMIN] Symbol Intelligence Audit')) ||
            (articleHtmlRaw && articleHtmlRaw.includes('[ADMIN] Symbol Intelligence Audit'));
          if (hasAdminLeak) {
            console.log('🧹 Admin audit detected in brief — regenerating clean version...');
            await generateFreshBrief();
            return; // Wait for reload
          }
        }
        
        // Remove any accidental ADMIN audit block from content just in case old cached content is shown
        const sanitizeAdminLeak = (text?: string) => {
          if (!text) return '';
          return text.replace(/---[\s\S]*?\*\*\[ADMIN\]\s*Symbol Intelligence Audit\*\*[\s\S]*?---/g, '').trim();
        };

        // Lightweight Markdown → HTML to fix headings like "### What's Next" and basic lists
        const markdownToHtml = (md?: string) => {
          if (!md) return '';
          const lines = md.split(/\r?\n/);
          const out: string[] = [];
          let i = 0;
          const esc = (t: string) => t
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

          const flushPara = (buf: string[]) => {
            if (!buf.length) return;
            const text = esc(buf.join(' ').trim());
            if (text) out.push(`<p>${text}</p>`);
            buf.length = 0;
          };

          let para: string[] = [];
          while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) { flushPara(para); i++; continue; }

            // Headings
            let m;
            if ((m = line.match(/^###\s+(.+)$/))) { flushPara(para); out.push(`<h3>${esc(m[1])}</h3>`); i++; continue; }
            if ((m = line.match(/^##\s+(.+)$/)))  { flushPara(para); out.push(`<h2>${esc(m[1])}</h2>`); i++; continue; }
            if ((m = line.match(/^#\s+(.+)$/)))   { flushPara(para); out.push(`<h1>${esc(m[1])}</h1>`); i++; continue; }

            // Unordered list block
            if (/^[-*]\s+/.test(line)) {
              flushPara(para);
              out.push('<ul>');
              while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                const item = lines[i].replace(/^[-*]\s+/, '');
                out.push(`<li>${esc(item)}</li>`);
                i++;
              }
              out.push('</ul>');
              continue;
            }

            // Ordered list block
            if (/^\d+\.\s+/.test(line)) {
              flushPara(para);
              out.push('<ol>');
              while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\d+\.\s+/, '');
                out.push(`<li>${esc(item)}</li>`);
                i++;
              }
              out.push('</ol>');
              continue;
            }

            // Regular paragraph line
            para.push(line);
            i++;
          }
          flushPara(para);
          return out.join('\n');
        };

        const aiText = (briefData as any)?.content_sections?.ai_generated_content as string | undefined;
        const cleanAiText = sanitizeAdminLeak(aiText);
        const articleHtmlFromAI = markdownToHtml(cleanAiText);

        const cleanArticleHtml = sanitizeAdminLeak(briefData.article_html);
        const displayDate = briefData.published_at || briefData.created_at;

        // If stored article_html still contains markdown (e.g., headings like ###), convert it
        const containsMarkdown = /(^|\n)#{1,6}\s|\n[-*]\s|\n\d+\.\s/.test(cleanArticleHtml);
        const processedStoredHtml = containsMarkdown ? markdownToHtml(cleanArticleHtml) : cleanArticleHtml;

        const brief: MarketBrief = {
          slug: briefData.slug || '',
          date: displayDate ? new Date(displayDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
          title: briefData.title || '',
          summary: briefData.executive_summary || briefData.summary || '',
          article_html: cleanArticleHtml || articleHtmlFromAI || '',
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

  const generateFreshBrief = async () => {
    try {
      setGenerating(true);
      console.log('🚀 Generating fresh market brief via edge function...');

      const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: {}
      });

      if (error) {
        console.error('❌ Brief generation failed:', error);
        toast({
          title: "Generation Failed",
          description: `Brief generation failed: ${JSON.stringify(error)}`,
          variant: "destructive"
        });
        throw error;
      }

      console.log('✅ Fresh brief generated successfully:', data);
      toast({
        title: "Fresh Brief Published!",
        description: data?.message || 'New brief created with current market insights.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('💥 Fresh brief creation error:', error);
      toast({
        title: "Creation Failed",
        description: `Error: ${error}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Regenerate Brief button disabled per request */} {false && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={generateFreshBrief}
              disabled={generating}
              className="btn-hero"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Regenerating...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Regenerate Today's Brief
                </>
              )}
            </Button>)}
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
            <div className="mb-6">
              {/* Live Refs Timestamp */}
              {quotesTimestamp && (
                <div className="mb-4 pb-3 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary/60 rounded-full"></div>
                  <span>
                    Live refs updated at{' '}
                    <strong className="text-foreground">
                      {format(toZonedTime(new Date(quotesTimestamp), 'America/Denver'), 'HH:mm')} MT
                    </strong>
                    {' '}• data: CoinGecko, Polygon, CoinGlass
                  </span>
                </div>
              )}
              
              {/* Live Prices Indicator */}
              {pricesLoading && (
                <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Updating live prices...
                </div>
              )}
              
              <EnhancedBriefRenderer 
                content={brief.article_html || ''} 
                enhancedTickers={livePrices}
                onTickersExtracted={handleTickersExtracted}
              />
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
                    <div className="mt-4">
                      <Button size="sm" onClick={generateComprehensiveBrief} disabled={generating}>
                        {generating ? 'Generating…' : 'Regenerate Now'}
                      </Button>
                    </div>
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

            {/* All Mentioned Tickers Charts Section */}
            {extractedTickers.length > 0 && (
              <div className="border-t border-border pt-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">All Mentioned Assets</h3>
                  <span className="text-sm text-muted-foreground">({extractedTickers.length} assets)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {extractedTickers.slice(0, 12).map((ticker) => {
                    const { symbol, displayName, tvOk } = mapTickerToTradingView(ticker);
                    const unsupportedSet = new Set(['FIGR_HELOC']);
                    const isUnsupported = unsupportedSet.has(ticker.toUpperCase());
                    return (
                      <Card key={ticker} className="h-48">
                        <CardContent className="p-3">
                          <div className="text-sm font-medium mb-2 text-center truncate" title={displayName}>
                            {displayName}
                          </div>
                          <div className="h-36">
                            {isUnsupported ? (
                              <a
                                href={`https://www.coingecko.com/en/search?query=${encodeURIComponent(ticker)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-full h-full text-sm text-primary underline"
                              >
                                View on CoinGecko
                              <ExternalLink className="w-4 h-4 ml-1" />
                            </a>
                          ) : (
                            <MiniChart symbol={symbol} theme={theme} tvOk={tvOk} />
                          )}
                        </div>
                      </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {extractedTickers.length > 12 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 12 of {extractedTickers.length} mentioned assets
                  </p>
                )}
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
                      <MiniChart symbol={mapTickerToTradingView('BTC').symbol} theme={theme} />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="h-48">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium mb-2 text-center">Ethereum (ETH)</div>
                    <div className="h-36">
                      <MiniChart symbol={mapTickerToTradingView('ETH').symbol} theme={theme} />
                    </div>
                  </CardContent>
                </Card>

                {/* Dynamic charts based on featured assets */}
                {briefData?.featured_assets?.includes('SOL') && (
                  <Card className="h-48">
                    <CardContent className="p-3">
                      <div className="text-sm font-medium mb-2 text-center">Solana (SOL)</div>
                      <div className="h-36">
                        <MiniChart symbol={mapTickerToTradingView('SOL').symbol} theme={theme} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Add S&P 500 for market context */}
                <Card className="h-48">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium mb-2 text-center">S&P 500 (SPY)</div>
                    <div className="h-36">
                      <MiniChart symbol={mapTickerToTradingView('SPY').symbol} theme={theme} />
                    </div>
                  </CardContent>
                </Card>

                {/* Add DXY when discussing macro */}
                {brief.article_html?.toLowerCase().includes('dollar') && (
                  <Card className="h-48">
                    <CardContent className="p-3">
                      <div className="text-sm font-medium mb-2 text-center">US Dollar Index</div>
                      <div className="h-36">
                        <MiniChart symbol={mapTickerToTradingView('DXY').symbol} theme={theme} />
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
                        <MiniChart symbol={mapTickerToTradingView('XAUUSD').symbol} theme={theme} />
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
