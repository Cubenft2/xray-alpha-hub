import { MessageSquare, Heart, ExternalLink, Twitter, Youtube, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  text?: string;
  body?: string;
  author?: string;
  handle?: string;
  platform?: string;
  interactions?: number;
  likes?: number;
  created_at?: string;
  post_url?: string;
  url?: string;
}

interface TokenPostsProps {
  topPosts: Post[] | null;
}

const formatNumber = (num: number | null | undefined) => {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

const getPlatformIcon = (platform?: string) => {
  switch (platform?.toLowerCase()) {
    case 'twitter':
    case 'x':
      return Twitter;
    case 'youtube':
      return Youtube;
    case 'telegram':
      return Send;
    default:
      return MessageSquare;
  }
};

const getPlatformColor = (platform?: string) => {
  switch (platform?.toLowerCase()) {
    case 'twitter':
    case 'x':
      return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
    case 'youtube':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'telegram':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function TokenPosts({ topPosts }: TokenPostsProps) {
  if (!topPosts || topPosts.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Top Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No post data available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Top Posts
          <Badge variant="secondary" className="ml-auto text-xs">
            {topPosts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topPosts.slice(0, 5).map((post, i) => {
          const PlatformIcon = getPlatformIcon(post.platform);
          const postText = post.text || post.body || '';
          const postUrl = post.post_url || post.url;
          
          return (
            <div 
              key={i}
              className="p-3 rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/20 hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => postUrl && window.open(postUrl, '_blank')}
            >
              {/* Platform & Author */}
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-xs ${getPlatformColor(post.platform)}`}>
                  <PlatformIcon className="h-3 w-3 mr-1" />
                  {post.platform || 'Social'}
                </Badge>
                {post.author && (
                  <span className="text-sm font-medium">{post.author}</span>
                )}
                {post.handle && (
                  <span className="text-xs text-muted-foreground">@{post.handle}</span>
                )}
                {postUrl && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                )}
              </div>

              {/* Post Text */}
              <p className="text-sm line-clamp-3 mb-2">{postText}</p>

              {/* Engagement & Time */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {(post.interactions || post.likes) && (
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span>{formatNumber(post.interactions || post.likes)}</span>
                  </div>
                )}
                {post.created_at && (
                  <span>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
