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

interface NewsSectionProps {
  searchTerm?: string;
  defaultTab?: 'crypto' | 'stocks';
}

export function NewsSection({ searchTerm = '', defaultTab = 'crypto' }: NewsSectionProps) {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stocksNews, setStocksNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newItemsCount, setNewItemsCount] = useState({ crypto: 0, stocks: 0 });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
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

  // Enhanced news fetching with live updates
  const fetchNews = async () => {
    setIsLoading(true);
    console.log('🐕 XRay: Fetching news...');
    
    try {
      // Fetch from multiple sources in parallel
      const workerUrl = 'https://xraycrypto-news.xrprat.workers.dev/aggregate?sources=crypto,stocks';
      const cryptoPanicUrl = 'https://cryptopanic.com/api/v1/posts/?auth_token=free&public=true&kind=news&currencies=BTC,ETH,SOL&filter=hot';
      
      const fetchPromises = [];
      
      // Fetch from worker
      fetchPromises.push(
        fetch(workerUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        }).then(res => res.json()).catch(() => null)
      );
      
      // Fetch from CryptoPanic
      fetchPromises.push(
        fetch(cryptoPanicUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        }).then(res => res.json()).catch(() => null)
      );
      
      const [workerData, cryptoPanicData] = await Promise.all(fetchPromises);
      
      let allNewsItems: NewsItem[] = [];
      
      // Process worker data
      if (workerData?.latest) {
        console.log('🐕 XRay: Worker response:', workerData);
        const raw = Array.isArray(workerData.latest) ? workerData.latest : [];
        const normalized: NewsItem[] = raw.map((it: any) => {
          const url = it.link || it.url || '';
          let source = it.source || '';
          if (!source && url) {
            try { source = new URL(url).hostname.replace(/^www\./,''); } catch {}
          }
          
          // Parse timestamp correctly - API returns Unix timestamp in milliseconds
          let publishedAt = new Date().toISOString(); // fallback
          if (it.date) {
            const timestamp = typeof it.date === 'number' ? it.date : parseInt(it.date, 10);
            if (!isNaN(timestamp)) {
              publishedAt = new Date(timestamp).toISOString();
            }
          }
          
          return {
            title: it.title || it.headline || 'Untitled',
            description: it.description || it.summary || 'No description available.',
            url,
            publishedAt,
            source: source || 'news'
          } as NewsItem;
        });
        allNewsItems.push(...normalized);
      }
      
      // Process CryptoPanic data
      if (cryptoPanicData?.results) {
        console.log('🐕 XRay: CryptoPanic response:', cryptoPanicData.results.length, 'items');
        const cryptoPanicItems: NewsItem[] = cryptoPanicData.results.map((item: any) => ({
          title: item.title || 'Untitled',
          description: item.title || 'No description available.',
          url: item.url || '',
          publishedAt: item.published_at || new Date().toISOString(),
          source: item.domain || 'cryptopanic.com'
        }));
        allNewsItems.push(...cryptoPanicItems);
      }
      
      if (allNewsItems.length > 0) {
        console.log('🐕 XRay: Using combined news data from', allNewsItems.length, 'sources');
        
        // Enhanced categorization by source host and content
        const isCryptoHost = (host: string) => /coindesk|cointelegraph|theblock|decrypt|messari|chain\.link|cryptoslate|bitcoinmagazine|blockworks|thedefiant|protos|ambcrypto|beincrypto|coingape|coinpedia|cryptopotato|newsbtc|cryptopanic/i.test(host || '');
        const isStocksHost = (host: string) => /reuters|cnbc|foxbusiness|apnews|finance\.yahoo|ft\.com|cnn|nytimes|marketwatch|moneycontrol|theguardian|bbc|bbci|wsj/i.test(host || '');
        
        const cryptoItems = allNewsItems.filter(n => 
          isCryptoHost(n.source) || 
          /bitcoin|ethereum|crypto|btc|eth|solana|sol|defi|nft|web3|blockchain|dogecoin|cardano|polkadot/i.test(n.title)
        ).slice(0, 30);
        
        const stocksItems = allNewsItems.filter(n => 
          (isStocksHost(n.source) || /stocks?|market|fed|nasdaq|s&p|dow|sp500|trading|earnings|dividend|wall street/i.test(n.title)) &&
          !isCryptoHost(n.source) &&
          !/bitcoin|ethereum|crypto|btc|eth|solana|defi/i.test(n.title)
        ).slice(0, 30);

        if (isFirstLoad) {
          // First load - set all items
          setCryptoNews(cryptoItems.length > 0 ? cryptoItems : allNewsItems.slice(0, 15));
          setStocksNews(stocksItems.length > 0 ? stocksItems : allNewsItems.slice(15, 30));
          setIsFirstLoad(false);
        } else {
          // Live update - add only new items
          setCryptoNews(prevCrypto => {
            const newItems = cryptoItems.filter(newItem => 
              !prevCrypto.some(existing => existing.title === newItem.title || existing.url === newItem.url)
            );
            setNewItemsCount(prev => ({ ...prev, crypto: newItems.length }));
            return [...newItems, ...prevCrypto].slice(0, 30); // Limit to 30 items
          });
          
          setStocksNews(prevStocks => {
            const newItems = stocksItems.filter(newItem => 
              !prevStocks.some(existing => existing.title === newItem.title || existing.url === newItem.url)
            );
            setNewItemsCount(prev => ({ ...prev, stocks: newItems.length }));
            return [...newItems, ...prevStocks].slice(0, 30); // Limit to 30 items
          });
        }
      } else {
        console.log('🐕 XRay: No items from sources, using mock data');
        if (isFirstLoad) {
          setCryptoNews(mockCryptoNews);
          setStocksNews(mockStocksNews);
          setIsFirstLoad(false);
        }
      }
      
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error fetching news:', error);
      if (isFirstLoad) {
        setCryptoNews(mockCryptoNews);
        setStocksNews(mockStocksNews);
        setIsFirstLoad(false);
      }
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
      
      if (!isFirstLoad) {
        const totalNew = newItemsCount.crypto + newItemsCount.stocks;
        if (totalNew > 0) {
          toast({
            title: `${totalNew} New Articles`,
            description: "Fresh news items have been added.",
          });
        }
        
        // Reset counter after a delay
        setTimeout(() => {
          setNewItemsCount({ crypto: 0, stocks: 0 });
        }, 3000);
      }
    }
  };

  useEffect(() => {
    console.log('🐕 XRay: NewsSection component mounted, fetching news...');
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

  const NewsCard = ({ item, isNew = false }: { item: NewsItem; isNew?: boolean }) => (
    <div className={`border border-border rounded-lg p-4 hover-glow-news cursor-pointer transition-all duration-500 ${
      isNew ? 'animate-slide-in-top bg-primary/5 border-primary/30' : ''
    }`}>
      <div className="flex items-start justify-between mb-2">
        {isNew && (
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground mr-2">
            NEW
          </div>
        )}
        <h3 className="font-medium text-sm line-clamp-2 flex-1">{item.title}</h3>
        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
          {formatTime(item.publishedAt)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => item.url && window.open(item.url, '_blank', 'noopener') }>
          Read More
        </Button>
      </div>
    </div>
  );

  // Filter news based on search term
  const filterNews = (news: NewsItem[]) => {
    if (!searchTerm.trim()) return news;
    const term = searchTerm.toLowerCase();
    return news.filter(item => 
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.source.toLowerCase().includes(term)
    );
  };

  const filteredCryptoNews = filterNews(cryptoNews);
  const filteredStocksNews = filterNews(stocksNews);

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

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="crypto" className="text-xs hover-glow-tab transition-all duration-300">
            🚀 Crypto ({filteredCryptoNews.length})
          </TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs hover-glow-tab transition-all duration-300">
            📈 Markets ({filteredStocksNews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="mt-4">
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading crypto news...
              </div>
            ) : filteredCryptoNews.length > 0 ? (
              filteredCryptoNews.map((item, index) => (
                <NewsCard 
                  key={`${item.url || item.title}-${index}`} 
                  item={item} 
                  isNew={index < newItemsCount.crypto}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {searchTerm ? `No crypto news found for "${searchTerm}"` : 'No crypto news available'}
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
            ) : filteredStocksNews.length > 0 ? (
              filteredStocksNews.map((item, index) => (
                <NewsCard 
                  key={`${item.url || item.title}-${index}`} 
                  item={item} 
                  isNew={index < newItemsCount.stocks}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {searchTerm ? `No market news found for "${searchTerm}"` : 'No market news available'}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}