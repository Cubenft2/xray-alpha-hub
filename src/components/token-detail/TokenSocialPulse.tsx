import { Users, MessageCircle, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TokenSocialPulseProps {
  galaxyScore: number | null;
  altRank: number | null;
  sentiment: number | null;
  sentimentLabel: string | null;
  socialVolume24h: number | null;
  interactions24h: number | null;
  contributorsActive: number | null;
  socialDominance: number | null;
  // Platform breakdown
  twitterVolume: number | null;
  twitterSentiment: number | null;
  redditVolume: number | null;
  redditSentiment: number | null;
  youtubeVolume: number | null;
  youtubeSentiment: number | null;
  tiktokVolume: number | null;
  tiktokSentiment: number | null;
  telegramVolume: number | null;
  telegramSentiment: number | null;
  socialUpdatedAt: string | null;
}

export function TokenSocialPulse({
  galaxyScore,
  altRank,
  sentiment,
  sentimentLabel,
  socialVolume24h,
  interactions24h,
  contributorsActive,
  socialDominance,
  twitterVolume,
  twitterSentiment,
  redditVolume,
  redditSentiment,
  youtubeVolume,
  youtubeSentiment,
  tiktokVolume,
  tiktokSentiment,
  telegramVolume,
  telegramSentiment,
  socialUpdatedAt,
}: TokenSocialPulseProps) {
  const hasData = galaxyScore !== null || sentiment !== null || socialVolume24h !== null;

  if (!hasData) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Social Pulse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Social data not available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (value: number | null) => {
    if (value === null) return 'N/A';
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getSentimentColor = (sentiment: number | null) => {
    if (sentiment === null) return 'text-muted-foreground';
    if (sentiment >= 70) return 'text-green-500';
    if (sentiment >= 50) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getGalaxyScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getAltRankBadge = (rank: number | null) => {
    if (rank === null) return null;
    if (rank <= 10) return <Badge className="bg-yellow-500 text-black">Top 10</Badge>;
    if (rank <= 50) return <Badge variant="secondary">Top 50</Badge>;
    if (rank <= 100) return <Badge variant="outline">Top 100</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  // Calculate platform breakdown percentages
  const totalVolume = (twitterVolume || 0) + (redditVolume || 0) + (youtubeVolume || 0) + (tiktokVolume || 0) + (telegramVolume || 0);
  const hasPlatformData = totalVolume > 0;

  const platforms = [
    { name: 'Twitter', volume: twitterVolume, sentiment: twitterSentiment, color: 'bg-blue-500' },
    { name: 'Reddit', volume: redditVolume, sentiment: redditSentiment, color: 'bg-orange-500' },
    { name: 'YouTube', volume: youtubeVolume, sentiment: youtubeSentiment, color: 'bg-red-500' },
    { name: 'TikTok', volume: tiktokVolume, sentiment: tiktokSentiment, color: 'bg-pink-500' },
    { name: 'Telegram', volume: telegramVolume, sentiment: telegramSentiment, color: 'bg-sky-500' },
  ].filter(p => p.volume !== null && p.volume > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Social Pulse
          </CardTitle>
          {altRank && getAltRankBadge(altRank)}
        </div>
        {socialUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(socialUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metrics */}
        <div className="grid grid-cols-3 gap-4">
          {galaxyScore !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className={getGalaxyScoreColor(galaxyScore)}>{galaxyScore}</span>
              </div>
              <div className="text-xs text-muted-foreground">Galaxy Score</div>
            </div>
          )}
          {altRank !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold">#{altRank}</div>
              <div className="text-xs text-muted-foreground">Alt Rank</div>
            </div>
          )}
          {sentiment !== null && (
            <div className="text-center">
              <div className={`text-2xl font-bold ${getSentimentColor(sentiment)}`}>
                {sentiment}%
              </div>
              <div className="text-xs text-muted-foreground">
                {sentimentLabel || (sentiment >= 60 ? 'Bullish' : sentiment >= 40 ? 'Neutral' : 'Bearish')}
              </div>
            </div>
          )}
        </div>

        {/* Activity Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {socialVolume24h !== null && (
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-semibold">{formatNumber(socialVolume24h)}</div>
                <div className="text-xs text-muted-foreground">Posts (24h)</div>
              </div>
            </div>
          )}
          {interactions24h !== null && (
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-semibold">{formatNumber(interactions24h)}</div>
                <div className="text-xs text-muted-foreground">Engagements</div>
              </div>
            </div>
          )}
          {contributorsActive !== null && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-semibold">{formatNumber(contributorsActive)}</div>
                <div className="text-xs text-muted-foreground">Creators</div>
              </div>
            </div>
          )}
          {socialDominance !== null && (
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-semibold">{socialDominance.toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">Social Dom.</div>
              </div>
            </div>
          )}
        </div>

        {/* Platform Breakdown */}
        {hasPlatformData && (
          <div className="pt-2 border-t space-y-2">
            <div className="text-sm text-muted-foreground">Platform Breakdown</div>
            <div className="flex h-3 rounded-full overflow-hidden">
              {platforms.map((platform, i) => {
                const pct = ((platform.volume || 0) / totalVolume) * 100;
                return (
                  <div
                    key={platform.name}
                    className={platform.color}
                    style={{ width: `${pct}%` }}
                    title={`${platform.name}: ${pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {platforms.map((platform) => {
                const pct = ((platform.volume || 0) / totalVolume) * 100;
                return (
                  <div key={platform.name} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${platform.color}`} />
                    <span>{platform.name}</span>
                    <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
