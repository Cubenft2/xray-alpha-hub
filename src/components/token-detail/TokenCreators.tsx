import { Users, ExternalLink, Twitter, Youtube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Creator {
  name?: string;
  handle?: string;
  avatar_url?: string;
  platform?: string;
  followers?: number;
  engagement?: number;
  profile_url?: string;
}

interface TokenCreatorsProps {
  topCreators: Creator[] | null;
}

const formatNumber = (num: number | null | undefined) => {
  if (!num) return '-';
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
    default:
      return Users;
  }
};

const getPlatformColor = (platform?: string) => {
  switch (platform?.toLowerCase()) {
    case 'twitter':
    case 'x':
      return 'text-sky-500';
    case 'youtube':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
};

export function TokenCreators({ topCreators }: TokenCreatorsProps) {
  if (!topCreators || topCreators.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Creators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No creator data available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Top Creators
          <Badge variant="secondary" className="ml-auto text-xs">
            {topCreators.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topCreators.slice(0, 10).map((creator, i) => {
          const PlatformIcon = getPlatformIcon(creator.platform);
          return (
            <div 
              key={i}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => creator.profile_url && window.open(creator.profile_url, '_blank')}
            >
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={creator.avatar_url} alt={creator.name} />
                <AvatarFallback className="text-xs">
                  {creator.name?.slice(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {creator.name || 'Unknown'}
                  </span>
                  <PlatformIcon className={`h-4 w-4 shrink-0 ${getPlatformColor(creator.platform)}`} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {creator.handle && <span>@{creator.handle}</span>}
                  {creator.followers && (
                    <>
                      <span>•</span>
                      <span>{formatNumber(creator.followers)} followers</span>
                    </>
                  )}
                </div>
              </div>

              {creator.engagement && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {formatNumber(creator.engagement)} eng
                </Badge>
              )}

              {creator.profile_url && (
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
