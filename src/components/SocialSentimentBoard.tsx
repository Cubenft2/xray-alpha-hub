import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Zap, Target, TrendingUp, MessageSquare, ExternalLink, Loader2, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { useSocialSentiment } from '@/hooks/useSocialSentiment';

export function SocialSentimentBoard() {
  const navigate = useNavigate();
  const { assets, metadata, loading, error, refetch } = useSocialSentiment();

  const handleTokenClick = (symbol: string) => {
    navigate(`/crypto?symbol=${symbol.toUpperCase()}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 70) return 'Very Bullish';
    if (sentiment >= 55) return 'Bullish';
    if (sentiment >= 46) return 'Neutral';
    if (sentiment >= 30) return 'Bearish';
    return 'Very Bearish';
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 55) return 'text-green-500 border-green-500/20 bg-green-500/10';
    if (sentiment >= 46) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    return 'text-red-500 border-red-500/20 bg-red-500/10';
  };

  const formatSocialVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const getDataFreshness = () => {
    if (!metadata?.last_updated) return null;
    
    const lastUpdate = new Date(metadata.last_updated);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1.5) return { color: 'text-green-500', label: 'Fresh', status: 'fresh' };
    if (diffHours < 3) return { color: 'text-yellow-500', label: 'Recent', status: 'recent' };
    return { color: 'text-red-500', label: 'Stale', status: 'stale' };
  };

  const formatLastUpdated = () => {
    if (!metadata?.last_updated) return 'Unknown';
    
    const lastUpdate = new Date(metadata.last_updated);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  };

  const freshness = getDataFreshness();
  const isStale = freshness?.status === 'stale';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="xr-card">
        <CardContent className="py-12 text-center">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load social sentiment data: {error}
            </AlertDescription>
          </Alert>
          <Button onClick={refetch} className="mt-4" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Freshness Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm">
            <span className="text-muted-foreground">Last updated: </span>
            <span className="font-medium">{formatLastUpdated()}</span>
            {freshness && (
              <>
                <span className="mx-2">•</span>
                <span className={`font-medium ${freshness.color}`}>
                  ● {freshness.label}
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            ({metadata?.source || 'unknown'})
          </div>
        </div>
        <Button 
          onClick={refetch} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stale Data Warning */}
      {isStale && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Data is more than 3 hours old. Check your LunarCrush AI Agent webhook delivery.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Assets Tracked</p>
                <p className="text-2xl font-bold">{assets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Galaxy Score</p>
                <p className="text-2xl font-bold">
                  {assets.length > 0 
                    ? Math.round(assets.reduce((sum, a) => sum + a.galaxy_score, 0) / assets.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Social Vol</p>
                <p className="text-2xl font-bold">
                  {formatSocialVolume(assets.reduce((sum, a) => sum + a.social_volume, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">High FOMO</p>
                <p className="text-2xl font-bold">
                  {assets.filter(a => a.fomo_score > 60).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Social Sentiment Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.length > 0 ? (
              assets.map((asset, index) => (
                <div 
                  key={asset.symbol} 
                  className="border border-border/30 rounded-lg p-4 space-y-3 hover:bg-accent/10 transition-colors cursor-pointer group" 
                  onClick={() => handleTokenClick(asset.symbol)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {asset.name}
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs px-2 py-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTokenClick(asset.symbol);
                            }}
                          >
                            {asset.symbol}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          AltRank #{asset.alt_rank || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Galaxy Score */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Galaxy Score</span>
                        <span className={`${getScoreColor(asset.galaxy_score)} font-semibold`}>
                          {asset.galaxy_score}/100
                        </span>
                      </div>
                      <Progress value={asset.galaxy_score} className="h-2" />
                    </div>

                    {/* FOMO Score */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>FOMO Score</span>
                        <span className={`${getScoreColor(asset.fomo_score)} font-semibold`}>
                          {Math.round(asset.fomo_score)}
                        </span>
                      </div>
                      <Progress value={asset.fomo_score} className="h-2" />
                    </div>

                    {/* Social Volume */}
                    <div>
                      <p className="text-sm text-muted-foreground">Social Volume</p>
                      <p className="font-bold">{formatSocialVolume(asset.social_volume)}</p>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <p className="text-sm text-muted-foreground">Sentiment</p>
                      <Badge 
                        variant="outline" 
                        className={`${getSentimentColor(asset.sentiment)} font-semibold`}
                      >
                        {getSentimentLabel(asset.sentiment)}
                      </Badge>
                    </div>
                  </div>

                  {/* Social Dominance */}
                  {asset.social_dominance > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Social Dominance</span>
                        <span>{asset.social_dominance.toFixed(2)}%</span>
                      </div>
                      <Progress value={asset.social_dominance} className="h-2" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No social sentiment data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
