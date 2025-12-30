import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Clock, X, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NewsAlertBanner } from './NewsAlertBanner';
import { Badge } from '@/components/ui/badge';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sourceType?: string;
  // Enhanced Polygon.io metadata
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentReasoning?: string;
  tickers?: string[];
  keywords?: string[];
  imageUrl?: string;
  author?: string;
  // LunarCrush social engagement data
  socialEngagement?: {
    interactions24h: number;
    interactionsTotal: number;
    creatorFollowers: number;
    creatorName: string;
    creatorDisplayName?: string;
    creatorAvatar?: string;
    postSentiment: number;
  };
}

interface NewsSectionProps {
  searchTerm?: string;
  defaultTab?: 'crypto' | 'stocks' | 'trump';
}

export function NewsSection({ searchTerm = '', defaultTab = 'crypto' }: NewsSectionProps) {
  console.log('🐕 XRay: NewsSection component rendering...', { searchTerm, defaultTab });
  
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stocksNews, setStocksNews] = useState<NewsItem[]>([]);
  const [trumpNews, setTrumpNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newItemsCount, setNewItemsCount] = useState({ crypto: 0, stocks: 0, trump: 0 });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'trending' | 'polygon'>('all');
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [polygonAlert, setPolygonAlert] = useState<{
    count: number;
    latestHeadline: string;
    show: boolean;
  }>({ count: 0, latestHeadline: '', show: false });
  const { toast } = useToast();
  const newsTopRef = useRef<HTMLDivElement>(null);

  // Read-only news fetching - reads from cache only, NEVER triggers API calls
  // News is populated by crons: news-fetch (Polygon/RSS) and lunarcrush-news
  const fetchNews = async () => {
    console.log('🐕 XRay: Starting fetchNews function (cache-only)...');
    setIsLoading(true);

    try {
      // Call read-only cache function - ZERO external API calls
      const cachedNewsResult = await supabase.functions.invoke('get-cached-news', { body: {} });

      console.log('🐕 XRay: Cached news response:', cachedNewsResult);

      if (cachedNewsResult.error) {
        console.error('🐕 XRay: Cached news error:', cachedNewsResult.error);
        throw cachedNewsResult.error;
      }
      if (!cachedNewsResult.data) {
        throw new Error('No data from get-cached-news');
      }

      // Data is already merged by get-cached-news function
      // Filter out Polygon from crypto - crypto news comes from LunarCrush only
      let cryptoItems: NewsItem[] = (Array.isArray(cachedNewsResult.data.crypto) ? cachedNewsResult.data.crypto : [])
        .filter((item: NewsItem) => item.sourceType !== 'polygon');
      let stocksItems: NewsItem[] = Array.isArray(cachedNewsResult.data.stocks) ? cachedNewsResult.data.stocks : [];
      const trumpItems: NewsItem[] = Array.isArray(cachedNewsResult.data.trump) ? cachedNewsResult.data.trump : [];

      console.log(`✅ Got cached news: ${cryptoItems.length} crypto, ${stocksItems.length} stocks, ${trumpItems.length} trump`);

      console.log('🐕 XRay: Parsed news items:', {
        cryptoCount: cryptoItems.length,
        stocksCount: stocksItems.length,
        trumpCount: trumpItems.length
      });

      // Sort by publishedAt desc to ensure newest first
      cryptoItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      stocksItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      trumpItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // Compute new items for toast/alert before replacing state
      const prevCryptoKeys = new Set(cryptoNews.map((i) => i.url || i.title));
      const prevStocksKeys = new Set(stocksNews.map((i) => i.url || i.title));
      const prevTrumpKeys = new Set(trumpNews.map((i) => i.url || i.title));

      const newCrypto = cryptoItems.filter((i) => !prevCryptoKeys.has(i.url || i.title));
      const newStocks = stocksItems.filter((i) => !prevStocksKeys.has(i.url || i.title));
      const newTrump = trumpItems.filter((i) => !prevTrumpKeys.has(i.url || i.title));

      // Track new Polygon items for alert (only from stocks since crypto excludes Polygon)
      const newPolygonItems = newStocks.filter((i) => i.sourceType === 'polygon');

      // Replace state with latest server data (authoritative)
      setCryptoNews(cryptoItems.slice(0, 50));
      setStocksNews(stocksItems.slice(0, 50));
      setTrumpNews(trumpItems.slice(0, 50));

      if (!isFirstLoad) {
        setNewItemsCount({
          crypto: newCrypto.length,
          stocks: newStocks.length,
          trump: newTrump.length
        });

        // Show Polygon alert if there are new items
        if (newPolygonItems.length > 0) {
          setPolygonAlert({
            count: newPolygonItems.length,
            latestHeadline: newPolygonItems[0]?.title || '',
            show: true
          });
        }
      }

      setIsFirstLoad(false);

      setLastUpdated(new Date());

      if (!isFirstLoad) {
        toast({ title: 'News Updated', description: 'Latest articles added to the top.' });
      }
    } catch (error) {
      console.error('🐕 XRay: Edge function fetch failed:', error);
      if (!isFirstLoad) {
        toast({
          title: 'Update Failed',
          description: 'Could not fetch latest news. Showing cached articles.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);

      if (!isFirstLoad) {
        setTimeout(() => {
          const totalNew = newItemsCount.crypto + newItemsCount.stocks + newItemsCount.trump;
          if (totalNew > 0) {
            toast({ title: `${totalNew} New Articles Added`, description: 'Check the top of each news section.' });
          }
        }, 300);

        setTimeout(() => {
          setNewItemsCount({ crypto: 0, stocks: 0, trump: 0 });
        }, 3000);
      }
    }
  };

  useEffect(() => {
    console.log('🐕 XRay: NewsSection component mounted, fetching news...');
    fetchNews();
    // No auto-refresh - news is now updated via cron every 30 min
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatEngagement = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const NewsCard = ({ item, isNew = false }: { item: NewsItem; isNew?: boolean }) => {
    const handleShareToX = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Build tweet text with title and cashtags
      const cashtags = item.tickers?.slice(0, 3).map(t => `$${t}`).join(' ') || '';
      const tweetText = `${item.title}${cashtags ? ' ' + cashtags : ''}\n\n${item.url}\n\n#XRayCrypto #Crypto via @xrayzone`;
      
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
    };
    const isBlockedSite = (() => {
      try {
        const host = new URL(item.url).hostname.replace('www.', '').toLowerCase();
        return host.endsWith('cryptonews.com') || host.endsWith('fool.com');
      } catch {
        const src = (item.source || '').toLowerCase();
        return src.includes('cryptonews.com') || src.includes('fool.com');
      }
    })();
    const getSentimentColor = () => {
      if (!item.sentiment) return '';
      if (item.sentiment === 'positive') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-500/30';
      if (item.sentiment === 'negative') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-500/30';
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-500/30';
    };
    
    const getSentimentIcon = () => {
      if (!item.sentiment) return null;
      if (item.sentiment === 'positive') return '🟢';
      if (item.sentiment === 'negative') return '🔴';
      return '⚪';
    };

    const isPolygonSource = item.sourceType === 'polygon';
    
    // Derive a small favicon for the source and keep visuals subtle
    const hostname = (() => {
      try { return new URL(item.url).hostname.replace('www.', ''); } catch { return item.source; }
    })();
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

    // Card border glow based on sentiment
    const sentimentBorderClass = item.sentiment === 'positive' 
      ? 'border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.15)]' 
      : item.sentiment === 'negative' 
        ? 'border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]' 
        : '';
    
    return (
      <div className={`border border-border rounded-lg overflow-hidden hover-glow-news cursor-pointer transition-all duration-500 ${
        isNew ? 'animate-slide-in-top bg-primary/5 border-primary/30' : ''
      } ${item.socialEngagement ? 'border-orange-500/30' : ''} ${sentimentBorderClass}`}>
        {item.imageUrl && (
          <div className="hidden">
            <img src={item.imageUrl} alt={item.title} loading="lazy" />
          </div>
        )}
        <div className="p-4">
          {item.socialEngagement && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
              {item.socialEngagement.creatorAvatar && (
                <img 
                  src={item.socialEngagement.creatorAvatar} 
                  alt={item.socialEngagement.creatorName}
                  className="w-6 h-6 rounded-full"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {item.socialEngagement.creatorDisplayName || item.socialEngagement.creatorName}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatEngagement(item.socialEngagement.creatorFollowers)} followers
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-orange-500">
                🔥 {formatEngagement(item.socialEngagement.interactions24h)}
              </div>
            </div>
          )}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1 flex-wrap">
              {isNew && (
                <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground whitespace-nowrap">
                  NEW
                </div>
              )}
              {isPolygonSource && (
                <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
                  📊 Premium
                </div>
              )}
              {item.sentiment && (
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor()} whitespace-nowrap`}
                     title={item.sentimentReasoning || `${item.sentiment} sentiment`}>
                  {getSentimentIcon()} {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
              {formatTime(item.publishedAt)}
            </span>
          </div>
          <h3 className="font-medium text-sm line-clamp-2 mb-2">{item.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
          
          {item.tickers && item.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.tickers.slice(0, 5).map((ticker, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary"
                >
                  ${ticker}
                </span>
              ))}
              {item.tickers.length > 5 && (
                <span className="text-xs text-muted-foreground">+{item.tickers.length - 5} more</span>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <img src={faviconUrl} alt={`${item.source} logo`} className="w-4 h-4 rounded-sm opacity-70" loading="lazy" />
              <span className="text-[10px] text-muted-foreground/40">{hostname}</span>
              {item.author && (
                <span className="text-[10px] text-muted-foreground/40">• {item.author}</span>
              )}
              {isBlockedSite && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  🔒 Copy Link
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleShareToX} title="Share to X">
                <Share2 className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => {
                if (item.url && item.url !== '#') {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (isBlockedSite) {
                    const siteName = hostname || 'This site';
                    navigator.clipboard.writeText(item.url).then(() => {
                      toast({
                        title: "Link Copied",
                        description: `${siteName} blocks direct access. Paste the URL into a new tab.`,
                        duration: 4000
                      });
                    }).catch(() => {
                      alert(`${siteName} blocks direct access. Copy this URL manually:\n\n${item.url}`);
                    });
                  } else {
                    try {
                      const newWindow = window.open(item.url, '_blank', 'noopener,noreferrer');
                      if (!newWindow) {
                        navigator.clipboard.writeText(item.url).then(() => {
                          toast({
                            title: "Popup Blocked",
                            description: "Link copied to clipboard - paste in new tab.",
                            duration: 3000
                          });
                        });
                      }
                    } catch (error) {
                      console.error('Failed to open news link:', error, 'URL:', item.url);
                      navigator.clipboard.writeText(item.url).then(() => {
                        toast({
                          title: "Link Issue",
                          description: "URL copied to clipboard - paste in new tab.",
                          duration: 3000
                        });
                      });
                    }
                  }
                }
              }}>
                Read More
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filter news based on search term, ticker, and sentiment
  const filterNews = (news: NewsItem[]) => {
    let filtered = news;
    
    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.source.toLowerCase().includes(term)
      );
    }
    
    // Apply sentiment filter
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(item => item.sentiment === sentimentFilter);
    }
    
    return filtered;
  };

  // Calculate sentiment stats
  const calculateSentimentStats = (news: NewsItem[]) => {
    const withSentiment = news.filter(item => item.sentiment);
    const total = withSentiment.length;
    if (total === 0) return { positive: 0, negative: 0, neutral: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 };
    
    const positiveCount = withSentiment.filter(item => item.sentiment === 'positive').length;
    const negativeCount = withSentiment.filter(item => item.sentiment === 'negative').length;
    const neutralCount = withSentiment.filter(item => item.sentiment === 'neutral').length;
    
    return {
      positive: Math.round((positiveCount / total) * 100),
      negative: Math.round((negativeCount / total) * 100),
      neutral: Math.round((neutralCount / total) * 100),
      positiveCount,
      negativeCount,
      neutralCount
    };
  };

  const filteredCryptoNews = filterNews(cryptoNews);
  const filteredStocksNews = filterNews(stocksNews);
  const filteredTrumpNews = filterNews(trumpNews);

  // Apply view mode filter (trending, polygon premium, or all with priority)
  const applyViewModeFilter = (news: NewsItem[]) => {
    if (viewMode === 'trending') {
      // Show only items from last 7 days with social engagement, sorted by interactions
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      return news
        .filter(item => {
          // Must have social engagement
          if (!item.socialEngagement || item.socialEngagement.interactions24h <= 0) {
            return false;
          }
          // Must be from last 7 days
          const publishedTime = new Date(item.publishedAt || 0).getTime();
          return publishedTime > sevenDaysAgo;
        })
        .sort((a, b) => 
          (b.socialEngagement?.interactions24h || 0) - (a.socialEngagement?.interactions24h || 0)
        );
    }
    
    if (viewMode === 'polygon') {
      // Show only Polygon.io sourced news, sorted by recency
      return news
        .filter(item => item.sourceType === 'polygon')
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    
    // 'all' mode: prioritize Polygon news from last 2 hours, then rest by recency
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recentPolygon = news.filter(item => 
      item.sourceType === 'polygon' && 
      new Date(item.publishedAt).getTime() > twoHoursAgo
    );
    const rest = news.filter(item => 
      !(item.sourceType === 'polygon' && new Date(item.publishedAt).getTime() > twoHoursAgo)
    );
    
    return [...recentPolygon, ...rest];
  };

  const displayCryptoNews = applyViewModeFilter(filteredCryptoNews);
  const displayStocksNews = applyViewModeFilter(filteredStocksNews);
  const displayTrumpNews = applyViewModeFilter(filteredTrumpNews);

  // Combine all news for sentiment stats
  const allNews = useMemo(() => [...cryptoNews, ...stocksNews, ...trumpNews], [cryptoNews, stocksNews, trumpNews]);
  const sentimentStats = useMemo(() => calculateSentimentStats(allNews), [allNews]);

  // Check if any filters are active
  const hasActiveFilters = sentimentFilter !== 'all';

  const clearAllFilters = () => {
    setSentimentFilter('all');
  };

  return (
    <div className="xr-card p-4" ref={newsTopRef}>
      {polygonAlert.show && (
        <NewsAlertBanner
          count={polygonAlert.count}
          latestHeadline={polygonAlert.latestHeadline}
          onClose={() => setPolygonAlert(prev => ({ ...prev, show: false }))}
          onViewNews={() => {
            newsTopRef.current?.scrollIntoView({ behavior: 'smooth' });
            setPolygonAlert(prev => ({ ...prev, show: false }));
          }}
        />
      )}
      
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">📰 Financial News</h2>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNews}
            disabled={isLoading}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* View Mode Buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
          className="h-8"
        >
          All Sources
        </Button>
        <Button
          variant={viewMode === 'trending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('trending')}
          className="h-8"
        >
          🔥 Trending
        </Button>
        <Button
          variant={viewMode === 'polygon' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('polygon')}
          className="h-8"
        >
          📊 Polygon Premium
        </Button>
        {viewMode === 'trending' && (
          <span className="text-xs text-muted-foreground">
            Sorted by social engagement
          </span>
        )}
        {viewMode === 'polygon' && (
          <span className="text-xs text-muted-foreground">
            Enhanced sentiment & ticker data
          </span>
        )}
      </div>

      {/* Sentiment Filter */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Sentiment:</span>
        <Badge
          variant={sentimentFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
          onClick={() => setSentimentFilter('all')}
        >
          All
        </Badge>
        <Badge
          variant={sentimentFilter === 'positive' ? 'default' : 'outline'}
          className="cursor-pointer hover:bg-green-500/20 transition-colors text-xs border-green-500/30"
          onClick={() => setSentimentFilter(sentimentFilter === 'positive' ? 'all' : 'positive')}
        >
          🟢 Bullish ({sentimentStats.positiveCount})
        </Badge>
        <Badge
          variant={sentimentFilter === 'negative' ? 'default' : 'outline'}
          className="cursor-pointer hover:bg-red-500/20 transition-colors text-xs border-red-500/30"
          onClick={() => setSentimentFilter(sentimentFilter === 'negative' ? 'all' : 'negative')}
        >
          🔴 Bearish ({sentimentStats.negativeCount})
        </Badge>
        <Badge
          variant={sentimentFilter === 'neutral' ? 'default' : 'outline'}
          className="cursor-pointer hover:bg-gray-500/20 transition-colors text-xs border-gray-500/30"
          onClick={() => setSentimentFilter(sentimentFilter === 'neutral' ? 'all' : 'neutral')}
        >
          ⚪ Neutral ({sentimentStats.neutralCount})
        </Badge>
      </div>

      {/* Sentiment Stats Bar */}
      {sentimentStats.positiveCount + sentimentStats.negativeCount + sentimentStats.neutralCount > 0 && (
        <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
          <span>Today's Sentiment:</span>
          <span className="text-green-500">{sentimentStats.positive}% Bullish</span>
          <span>•</span>
          <span className="text-gray-500">{sentimentStats.neutral}% Neutral</span>
          <span>•</span>
          <span className="text-red-500">{sentimentStats.negative}% Bearish</span>
        </div>
      )}

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          <Badge variant="secondary" className="text-xs">
            Sentiment: {sentimentFilter}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2 text-xs ml-auto"
          >
            Clear All
          </Button>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="crypto" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">🚀 Crypto ({displayCryptoNews.length})</span>
            <span className="sm:hidden">🚀 Crypto</span>
          </TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">📈 Markets ({displayStocksNews.length})</span>
            <span className="sm:hidden">📈 Stock</span>
          </TabsTrigger>
          <TabsTrigger value="trump" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">🇺🇸 Trump ({displayTrumpNews.length})</span>
            <span className="sm:hidden">🇺🇸 Trump</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="mt-4">
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading crypto news...
              </div>
            ) : displayCryptoNews.length > 0 ? (
              displayCryptoNews.map((item, index) => (
                <NewsCard 
                  key={item.url || item.title} 
                  item={item} 
                  isNew={index < newItemsCount.crypto}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {hasActiveFilters ? 'No news matches your filters' :
                 viewMode === 'polygon' ? 'No Polygon Premium news available' :
                 viewMode === 'trending' ? 'No trending crypto news available' :
                 searchTerm ? `No crypto news found for "${searchTerm}"` : 'No crypto news available'}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stocks" className="mt-4">
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading market news...
              </div>
            ) : displayStocksNews.length > 0 ? (
              displayStocksNews.map((item, index) => (
                <NewsCard 
                  key={item.url || item.title} 
                  item={item} 
                  isNew={index < newItemsCount.stocks}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {hasActiveFilters ? 'No news matches your filters' :
                 viewMode === 'polygon' ? 'No Polygon Premium news available' :
                 viewMode === 'trending' ? 'No trending market news available' :
                 searchTerm ? `No market news found for "${searchTerm}"` : 'No market news available'}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trump" className="mt-4">
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading Trump news...
              </div>
            ) : displayTrumpNews.length > 0 ? (
              displayTrumpNews.map((item, index) => (
                <NewsCard 
                  key={item.url || item.title} 
                  item={item} 
                  isNew={index < newItemsCount.trump}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {hasActiveFilters ? 'No news matches your filters' :
                 viewMode === 'polygon' ? 'No Polygon Premium news available' :
                 viewMode === 'trending' ? 'No trending Trump news available' :
                 searchTerm ? `No Trump news found for "${searchTerm}"` : 'No Trump news available'}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}