import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

export function NewsSection() {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stocksNews, setStocksNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  // Mock news data for demonstration
  const mockCryptoNews: NewsItem[] = [
    {
      title: "Bitcoin Reaches New Monthly High",
      description: "Bitcoin continues its upward momentum as institutional adoption increases...",
      url: "#",
      publishedAt: new Date().toISOString(),
      source: "CoinDesk"
    },
    {
      title: "Ethereum 2.0 Staking Rewards Surge",
      description: "ETH stakers see increased rewards as network activity reaches all-time highs...",
      url: "#",
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      source: "CoinTelegraph"
    },
    {
      title: "Solana Ecosystem Sees Massive Growth",
      description: "SOL-based projects continue to attract developers and users...",
      url: "#",
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      source: "Decrypt"
    }
  ];

  const mockStocksNews: NewsItem[] = [
    {
      title: "Tech Stocks Rally on AI Optimism",
      description: "Major technology companies see gains as AI adoption accelerates across industries...",
      url: "#",
      publishedAt: new Date().toISOString(),
      source: "Reuters"
    },
    {
      title: "Federal Reserve Maintains Interest Rates",
      description: "The Fed holds rates steady as inflation shows signs of cooling...",
      url: "#",
      publishedAt: new Date(Date.now() - 1800000).toISOString(),
      source: "Bloomberg"
    },
    {
      title: "EV Sector Sees Mixed Performance",
      description: "Electric vehicle manufacturers report varying quarterly results...",
      url: "#",
      publishedAt: new Date(Date.now() - 5400000).toISOString(),
      source: "MarketWatch"
    }
  ];

  // Enhanced news fetching to work with Cloudflare Worker
  const fetchNews = async () => {
    setIsLoading(true);
    console.log('🐕 XRay: Fetching news...');
    
    try {
      // Try the demo endpoint first to test if worker is working
      const workerUrl = 'https://xraycrypto-news.xrprat.workers.dev/mix';
      
      try {
        console.log('🐕 XRay: Calling worker at:', workerUrl);
        const response = await fetch(workerUrl, {
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('🐕 XRay: Worker response:', data);
          
          // Normalize to our NewsItem shape
          const raw = Array.isArray(data.top) ? data.top : Array.isArray(data.latest) ? data.latest : [];
          const normalized: NewsItem[] = raw.map((it: any) => {
            const url = it.link || it.url || '';
            let source = it.source || '';
            if (!source && url) {
              try { source = new URL(url).hostname.replace(/^www\./,''); } catch {}
            }
            return {
              title: it.title || it.headline || 'Untitled',
              description: it.description || '',
              url,
              publishedAt: it.date ? new Date(it.date).toISOString() : new Date().toISOString(),
              source: source || 'news'
            } as NewsItem;
          });

          // Categorize by source host
          const isCryptoHost = (host: string) => /coindesk|cointelegraph|theblock|decrypt|messari|chain\.link|cryptoslate|bitcoinmagazine|blockworks|thedefiant|protos|ambcrypto|beincrypto|coingape|coinpedia|cryptopotato/i.test(host || '');
          const isStocksHost = (host: string) => /reuters|cnbc|foxbusiness|apnews|finance\.yahoo|ft\.com|cnn|nytimes|marketwatch|moneycontrol|theguardian|bbc|bbci/i.test(host || '');

          const cryptoItems = normalized.filter(n => isCryptoHost(n.source) || /bitcoin|ethereum|crypto|btc|eth|solana/i.test(n.title)).slice(0,5);
          const stocksItems = normalized.filter(n => isStocksHost(n.source) || /stocks?|market|fed|nasdaq|s&p|dow/i.test(n.title)).slice(0,5);

          if (normalized.length > 0) {
            console.log('🐕 XRay: Using live news data');
            setCryptoNews(cryptoItems.length > 0 ? cryptoItems : normalized.slice(0,5));
            setStocksNews(stocksItems.length > 0 ? stocksItems : normalized.slice(5,10));
          } else {
            console.log('🐕 XRay: No items from worker, using mock data');
            setCryptoNews(mockCryptoNews);
            setStocksNews(mockStocksNews);
          }
        } else {
          throw new Error(`Worker returned ${response.status}`);
        }
      } catch (workerError) {
        console.log('🐕 XRay: Worker error, using mock data:', workerError);
        // Fallback to mock data
        setCryptoNews(mockCryptoNews);
        setStocksNews(mockStocksNews);
      }
      
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error fetching news:', error);
      // Use mock data as ultimate fallback
      setCryptoNews(mockCryptoNews);
      setStocksNews(mockStocksNews);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
      
      toast({
        title: "News Updated",
        description: "Latest financial news has been loaded.",
      });
    }
  };

  useEffect(() => {
    fetchNews();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

  const NewsCard = ({ item }: { item: NewsItem }) => (
    <div className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-sm line-clamp-2 flex-1">{item.title}</h3>
        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
          {formatTime(item.publishedAt)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => item.url && window.open(item.url, '_blank', 'noopener') }>
          Read More
        </Button>
      </div>
    </div>
  );

  return (
    <div className="xr-card p-4">
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

      <Tabs defaultValue="crypto" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="crypto" className="text-xs">
            🚀 Crypto ({cryptoNews.length})
          </TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs">
            📈 Markets ({stocksNews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="space-y-3 mt-4">
          {cryptoNews.map((item, index) => (
            <NewsCard key={index} item={item} />
          ))}
        </TabsContent>

        <TabsContent value="stocks" className="space-y-3 mt-4">
          {stocksNews.map((item, index) => (
            <NewsCard key={index} item={item} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}