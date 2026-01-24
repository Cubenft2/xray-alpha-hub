import { Newspaper, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface NewsItem {
  title: string;
  url?: string;
  source?: string;
  published_at?: string;
  sentiment?: number;
  image_url?: string;
}

interface TokenNewsProps {
  topNews: NewsItem[] | null;
  newsUpdatedAt: string | null;
}

export function TokenNews({ topNews, newsUpdatedAt }: TokenNewsProps) {
  if (!topNews || topNews.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Latest News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No news available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentColor = (sentiment: number | undefined) => {
    if (sentiment === undefined) return '';
    if (sentiment >= 0.6) return 'text-green-500';
    if (sentiment >= 0.4) return 'text-muted-foreground';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Latest News
        </CardTitle>
        {newsUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(newsUpdatedAt), { addSuffix: true })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {topNews.slice(0, 8).map((news, i) => (
          <div 
            key={i} 
            className="border-b last:border-0 pb-3 last:pb-0 hover:bg-muted/30 rounded p-2 -mx-2 cursor-pointer transition-colors"
            onClick={() => news.url && window.open(news.url, '_blank')}
          >
            <div className="flex items-start gap-3">
              {news.image_url && (
                <img 
                  src={news.image_url} 
                  alt="" 
                  className="w-16 h-12 object-cover rounded shrink-0"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-2">{news.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {news.source && <span>{news.source}</span>}
                  {news.published_at && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(news.published_at), { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {news.url && <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
