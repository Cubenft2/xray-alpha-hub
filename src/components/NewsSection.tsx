import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

interface NewsSectionProps {
  searchTerm?: string;
  defaultTab?: 'crypto' | 'stocks' | 'trump';
}

export function NewsSection({ searchTerm = '', defaultTab = 'crypto' }: NewsSectionProps) {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stocksNews, setStocksNews] = useState<NewsItem[]>([]);
  const [trumpNews, setTrumpNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newItemsCount, setNewItemsCount] = useState({ crypto: 0, stocks: 0, trump: 0 });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const { toast } = useToast();

  // Enhanced news fetching with live updates
  const fetchNews = async () => {
    setIsLoading(true);
    console.log('🐕 XRay: Fetching news via edge function...');

    try {
      const { data, error } = await supabase.functions.invoke('news-fetch', {
        body: { limit: 100 }
      });

      if (error) throw error;
      if (!data) throw new Error('No data from edge function');

      const cryptoItems: NewsItem[] = Array.isArray(data.crypto) ? data.crypto : [];
      const stocksItems: NewsItem[] = Array.isArray(data.stocks) ? data.stocks : [];
      const trumpItems: NewsItem[] = Array.isArray(data.trump) ? data.trump : [];

      // Sort by publishedAt desc to ensure newest first
      cryptoItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      stocksItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      trumpItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      if (isFirstLoad) {
        setCryptoNews(cryptoItems.slice(0, 50));
        setStocksNews(stocksItems.slice(0, 50));
        setTrumpNews(trumpItems.slice(0, 50));
        setIsFirstLoad(false);
      } else {
        // Merge by URL or title, prepend new, keep max 50
        setCryptoNews((prev) => {
          const prevKeys = new Set(prev.map((i) => i.url || i.title));
          const incoming = cryptoItems.filter((i) => i.url || i.title);
          const newOnes = incoming.filter((i) => !prevKeys.has(i.url || i.title));
          if (newOnes.length > 0) setNewItemsCount((p) => ({ ...p, crypto: newOnes.length }));
          return [...newOnes, ...prev].slice(0, 50);
        });

        setStocksNews((prev) => {
          const prevKeys = new Set(prev.map((i) => i.url || i.title));
          const incoming = stocksItems.filter((i) => i.url || i.title);
          const newOnes = incoming.filter((i) => !prevKeys.has(i.url || i.title));
          if (newOnes.length > 0) setNewItemsCount((p) => ({ ...p, stocks: newOnes.length }));
          return [...newOnes, ...prev].slice(0, 50);
        });

        setTrumpNews((prev) => {
          const prevKeys = new Set(prev.map((i) => i.url || i.title));
          const incoming = trumpItems.filter((i) => i.url || i.title);
          const newOnes = incoming.filter((i) => !prevKeys.has(i.url || i.title));
          if (newOnes.length > 0) setNewItemsCount((p) => ({ ...p, trump: newOnes.length }));
          return [...newOnes, ...prev].slice(0, 50);
        });
      }

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
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
          if (item.url && item.url !== '#') {
            try {
              window.open(item.url, '_blank', 'noopener,noreferrer');
            } catch (error) {
              console.error('Failed to open news link:', error, 'URL:', item.url);
              // Fallback: try to navigate directly
              window.location.href = item.url;
            }
          }
        }}>
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
  const filteredTrumpNews = filterNews(trumpNews);

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="crypto" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">🚀 Crypto ({filteredCryptoNews.length})</span>
            <span className="sm:hidden">🚀 Crypto</span>
          </TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">📈 Markets ({filteredStocksNews.length})</span>
            <span className="sm:hidden">📈 Stock</span>
          </TabsTrigger>
          <TabsTrigger value="trump" className="text-xs hover-glow-tab transition-all duration-300">
            <span className="hidden sm:inline">🇺🇸 Trump ({filteredTrumpNews.length})</span>
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
            ) : filteredCryptoNews.length > 0 ? (
              filteredCryptoNews.map((item, index) => (
                <NewsCard 
                  key={item.url || item.title} 
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
                  key={item.url || item.title} 
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

        <TabsContent value="trump" className="mt-4">
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading Trump news...
              </div>
            ) : filteredTrumpNews.length > 0 ? (
              filteredTrumpNews.map((item, index) => (
                <NewsCard 
                  key={item.url || item.title} 
                  item={item} 
                  isNew={index < newItemsCount.trump}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                {searchTerm ? `No Trump news found for "${searchTerm}"` : 'No Trump news available'}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}