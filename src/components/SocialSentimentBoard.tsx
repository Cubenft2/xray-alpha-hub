import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Zap, Target, TrendingUp, MessageSquare, ExternalLink, Wifi, ChevronDown, ChevronUp, Download, Share2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
// html2canvas is dynamically imported when needed to reduce initial bundle size

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  alt_rank: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  fomo_score: number;
}

interface SocialSentimentBoardProps {
  marketData: any;
}

export function SocialSentimentBoard({ marketData }: SocialSentimentBoardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [displayCount, setDisplayCount] = useState(5);
  const [isExporting, setIsExporting] = useState(false);
  const siteHost = 'xraycrypto.io';

  // Fetch LunarCrush Universe data (refreshes every 15 minutes)
  const { data: universeData, isLoading } = useQuery({
    queryKey: ['lunarcrush-universe-social'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('lunarcrush-universe');
      if (error) throw error;
      
      // Filter and sort by social_volume to get the most socially active assets
      const topSocial = data?.data
        ?.filter((coin: any) => (coin.social_volume || 0) > 1000) // Only assets with significant social activity
        ?.sort((a: any, b: any) => (b.social_volume || 0) - (a.social_volume || 0))
        ?.slice(0, 25); // Top 25 by social volume
      
      // Debug: Log the top 3 coins to verify social_volume data
      console.log('🔍 Top 3 social coins:', topSocial?.slice(0, 3)?.map((c: any) => ({
        symbol: c.symbol,
        social_volume: c.social_volume,
        galaxy_score: c.galaxy_score
      })));
      
      return topSocial?.map((coin: any) => ({
        name: coin.name,
        symbol: coin.symbol,
        galaxy_score: coin.galaxy_score || 0,
        alt_rank: coin.alt_rank || 0,
        sentiment: coin.sentiment || 0,
        social_volume: coin.social_volume || 0,
        social_dominance: coin.social_dominance || 0,
        fomo_score: Math.min(100, Math.max(0, 50 + ((coin.percent_change_24h || 0) * 2)))
      })) || [];
    },
    refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
    staleTime: 14 * 60 * 1000, // Consider stale after 14 minutes
  });

  // Use universe data if available, otherwise fall back to brief snapshot
  const dataSource = universeData || marketData?.content_sections?.market_data?.social_sentiment;
  let socialAssets: SocialAsset[] = Array.isArray(dataSource) ? dataSource : [];

  // Fallback 1: use aggregated social_data.top_social_assets if detailed list is empty
  if (socialAssets.length === 0) {
    const sd = (marketData as any)?.content_sections?.social_data;
    const top = Array.isArray(sd?.top_social_assets) ? sd.top_social_assets : [];
    if (top.length > 0) {
      const avgScore = Math.round(sd?.avg_galaxy_score || 0);
      socialAssets = top.map((sym: string) => ({
        name: sym.toUpperCase(),
        symbol: sym,
        galaxy_score: avgScore,
        alt_rank: 0,
        sentiment: 0,
        social_volume: 0,
        social_dominance: 0,
        fomo_score: 0,
      }));
    }
  }

  // Fallback 2: derive from top gainers/losers if still empty
  if (socialAssets.length === 0) {
    const md = (marketData as any)?.content_sections?.market_data;
    const movers = [ ...(md?.top_gainers || []), ...(md?.top_losers || []) ];
    const fromMovers = movers.slice(0, 6).map((a: any) => ({
      name: a.name || (a.symbol || '').toUpperCase(),
      symbol: (a.symbol || '').toUpperCase(),
      galaxy_score: 0,
      alt_rank: 0,
      sentiment: typeof a.change_24h === 'number' ? (a.change_24h > 0 ? 0.25 : -0.25) : 0,
      social_volume: 0,
      social_dominance: 0,
      fomo_score: typeof a.change_24h === 'number' ? Math.max(0, Math.min(100, 50 + a.change_24h)) : 0,
    }));
    if (fromMovers.length > 0) socialAssets = fromMovers;
  }

  const handleTokenClick = (symbol: string) => {
    // Navigate to crypto-universe detail page which uses proper ticker mappings
    navigate(`/crypto-universe/${symbol.toUpperCase()}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 60) return 'text-green-500 border-green-500/20 bg-green-500/10';
    if (score >= 40) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    if (score >= 20) return 'text-orange-500 border-orange-500/20 bg-orange-500/10';
    return 'text-red-500 border-red-500/20 bg-red-500/10';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 0.6) return 'Very Bullish';
    if (sentiment >= 0.2) return 'Bullish';
    if (sentiment >= -0.2) return 'Neutral';
    if (sentiment >= -0.6) return 'Bearish';
    return 'Very Bearish';
  };

  const formatSocialVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const handleExportImage = async () => {
    if (!cardRef.current) return;
    
    setIsExporting(true);
    try {
      // Dynamic import - only loads ~1.3MB html2canvas when user clicks export
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `xraycrypto-social-sentiment-top${displayCount}-${date}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "✅ Exported Successfully",
        description: "Social sentiment card saved as image!",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "❌ Export Failed",
        description: "Could not export image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;

    setIsExporting(true);
    try {
      // Dynamic import - only loads ~1.3MB html2canvas when user clicks share
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const file = new File([blob], 'social-sentiment.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'XRayCrypto Social Sentiment',
          text: 'Check out the latest crypto social sentiment rankings! 🚀',
        });
        toast({
          title: "✅ Shared Successfully",
          description: "Social sentiment card shared!",
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast({
          title: "📋 Copied to Clipboard",
          description: "Image copied! Paste it anywhere.",
        });
      } else {
        const twitterText = encodeURIComponent('Latest crypto social sentiment rankings from @xrayzone 🚀');
        window.open(`https://x.com/intent/tweet?text=${twitterText}`, '_blank');
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast({
        title: "⚠️ Share Not Supported",
        description: "Try exporting as image instead.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const displayedAssets = socialAssets.slice(0, displayCount);

  return (
    <div className="space-y-3">
      {/* Live Data Badge */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wifi className="h-4 w-4 text-green-500 animate-pulse" />
        <span>
          {isLoading ? 'Loading social data...' : `Live LunarCrush data • ${socialAssets.length} assets tracked`}
        </span>
      </div>

      {/* Overview Cards - Hidden on desktop to avoid redundancy */}
      <div className="grid grid-cols-2 lg:hidden gap-2">
        <Card className="xr-card">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Assets Tracked</p>
                <p className="text-2xl font-bold">{socialAssets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Galaxy Score</p>
                <p className="text-2xl font-bold">
                  {socialAssets.length > 0 
                    ? Math.round(socialAssets.reduce((sum, asset) => sum + (asset.galaxy_score || 0), 0) / socialAssets.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Social Vol</p>
                <p className="text-2xl font-bold">
                  {formatSocialVolume(socialAssets.reduce((sum, asset) => sum + (asset.social_volume || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">High FOMO Assets</p>
                <p className="text-2xl font-bold">
                  {socialAssets.filter(asset => (asset.fomo_score || 0) > 60).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Social Sentiment Table */}
      <Card className="xr-card" ref={cardRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Social Sentiment Intelligence (LunarCrush)
            </CardTitle>
            {!isExporting && (
              <div className="flex gap-2">
                <Button onClick={handleExportImage} size="sm" variant="outline" disabled={isExporting}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button onClick={handleShare} size="sm" variant="outline" disabled={isExporting}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayedAssets.length > 0 ? (
              displayedAssets.map((asset, index) => (
                <div key={asset.symbol} className="border border-border/30 rounded-lg p-3 space-y-2 hover:bg-accent/10 transition-colors cursor-pointer group" onClick={() => handleTokenClick(asset.symbol)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">{asset.name}</h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs px-2 py-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTokenClick(asset.symbol);
                            }}
                          >
                            {asset.symbol.toUpperCase()}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
                    {/* Galaxy Score Progress */}
                    <div className="min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Galaxy Score</span>
                          <span className={`${getScoreColor(asset.galaxy_score || 0)} font-semibold text-sm`}>
                            {asset.galaxy_score || 0}/100
                          </span>
                        </div>
                        <Progress value={asset.galaxy_score || 0} className="h-2" />
                      </div>
                    </div>

                    {/* FOMO Score */}
                    <div className="min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">FOMO Score</span>
                          <span className={`${getScoreColor(asset.fomo_score || 0)} font-semibold text-sm`}>
                            {asset.fomo_score?.toFixed(0) || 0}
                          </span>
                        </div>
                        <Progress value={asset.fomo_score || 0} className="h-2" />
                      </div>
                    </div>

                    {/* Social Volume */}
                    <div>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">Social Volume</p>
                      <p className="font-bold text-foreground">{formatSocialVolume(asset.social_volume || 0)}</p>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">Sentiment</p>
                      <Badge 
                        variant="outline" 
                        className={`${asset.sentiment >= 0 
                          ? 'text-green-500 border-green-500/20 bg-green-500/10' 
                          : 'text-red-500 border-red-500/20 bg-red-500/10'
                        } font-semibold`}
                      >
                        {getSentimentLabel(asset.sentiment || 0)}
                      </Badge>
                    </div>
                  </div>

                  {/* Social Dominance - only show if significant */}
                  {asset.social_dominance > 1 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="whitespace-nowrap">Social Dominance</span>
                        <span className="ml-2">{asset.social_dominance.toFixed(2)}%</span>
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

            {/* Show More Button */}
            {!isExporting && socialAssets.length > 5 && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (displayCount >= socialAssets.length) {
                      setDisplayCount(5);
                    } else {
                      setDisplayCount(Math.min(displayCount + 5, socialAssets.length));
                    }
                  }}
                  className="gap-2"
                >
                  {displayCount >= socialAssets.length ? (
                    <>
                      Show Less <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Show {Math.min(5, socialAssets.length - displayCount)} More ({displayCount + Math.min(5, socialAssets.length - displayCount)} total) <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Live watermarks - centered below button */}
          {!isExporting && (
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border/30">
              <img 
                src="/zoobie-pfp.webp" 
                alt="Zoobie Beret Dog" 
                className="w-8 h-8 opacity-70 rounded-full"
              />
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">XRayCrypto™</span>
                <span className="mx-1">•</span>
                <span>@xrayzone</span>
                <span className="mx-1">•</span>
                <span>{siteHost}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {/* Watermark (only visible during export) */}
            {isExporting && (
              <div className="border-t border-border mt-4 pt-3 pb-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="text-sm font-bold text-foreground">
                    XRayCrypto™
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • @xrayzone
                  </div>
                </div>
                <div className="text-xs text-center text-muted-foreground mt-1">
                  Real-Time Social Sentiment Intelligence
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}