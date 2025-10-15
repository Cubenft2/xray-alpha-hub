import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, Share2, TrendingUp, Zap, Users, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  fomo_score?: number;
  sentiment?: number;
  social_volume?: number;
  social_dominance?: number;
  token_address?: string;
  alt_rank?: number;
}

interface SocialSentimentShareCardProps {
  socialAssets: SocialAsset[];
  totalTracked?: number;
  avgGalaxyScore?: number;
  generatedAt?: string;
}

export function SocialSentimentShareCard({
  socialAssets,
  totalTracked,
  avgGalaxyScore,
  generatedAt,
}: SocialSentimentShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Get sentiment label and color
  const getSentimentLabel = (sentiment?: number) => {
    if (!sentiment && sentiment !== 0) return { label: 'N/A', color: 'text-muted-foreground' };
    if (sentiment >= 0.6) return { label: 'Very Bullish', color: 'text-emerald-500' };
    if (sentiment >= 0.2) return { label: 'Bullish', color: 'text-green-500' };
    if (sentiment >= -0.2) return { label: 'Neutral', color: 'text-muted-foreground' };
    if (sentiment >= -0.6) return { label: 'Bearish', color: 'text-orange-500' };
    return { label: 'Very Bearish', color: 'text-red-500' };
  };

  // Find top assets
  const topGalaxyAsset = socialAssets.reduce((prev, current) => 
    (prev.galaxy_score > current.galaxy_score) ? prev : current
  , socialAssets[0]);

  const topFomoAsset = socialAssets.reduce((prev, current) => 
    ((prev.fomo_score || 0) > (current.fomo_score || 0)) ? prev : current
  , socialAssets[0]);

  const topVolumeAsset = socialAssets.reduce((prev, current) => 
    ((prev.social_volume || 0) > (current.social_volume || 0)) ? prev : current
  , socialAssets[0]);

  const handleExportImage = async () => {
    if (!cardRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `xraycrypto-social-sentiment-${date}.png`;
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
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
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
        const twitterText = encodeURIComponent('Latest crypto social sentiment rankings from @XRaycryptox 🚀');
        window.open(`https://twitter.com/intent/tweet?text=${twitterText}`, '_blank');
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleExportImage} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Export as Image
        </Button>
        <Button onClick={handleShare} variant="outline" disabled={isExporting}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </div>

      <Card ref={cardRef} className="relative overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Social Sentiment Rankings</h2>
            </div>
            <Badge variant="secondary" className="text-sm">
              {socialAssets.length} Assets
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top Performers Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-medium text-muted-foreground">Top Galaxy Score</p>
                </div>
                <p className="text-lg font-bold">{topGalaxyAsset.symbol}</p>
                <p className={`text-2xl font-bold ${getScoreColor(topGalaxyAsset.galaxy_score)}`}>
                  {topGalaxyAsset.galaxy_score.toFixed(1)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <p className="text-xs font-medium text-muted-foreground">Highest FOMO</p>
                </div>
                <p className="text-lg font-bold">{topFomoAsset.symbol}</p>
                <p className={`text-2xl font-bold ${getScoreColor(topFomoAsset.fomo_score || 0)}`}>
                  {(topFomoAsset.fomo_score || 0).toFixed(1)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <p className="text-xs font-medium text-muted-foreground">Top Volume</p>
                </div>
                <p className="text-lg font-bold">{topVolumeAsset.symbol}</p>
                <p className="text-2xl font-bold text-blue-500">
                  {((topVolumeAsset.social_volume || 0) / 1000).toFixed(1)}K
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Asset List */}
          <div className="space-y-3">
            {socialAssets.slice(0, 10).map((asset, index) => {
              const sentimentInfo = getSentimentLabel(asset.sentiment);
              return (
                <div key={asset.symbol} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                        {asset.token_address && !isExporting && (
                          <div className="flex items-center gap-1 mt-1">
                            <code className="text-[10px] text-muted-foreground">
                              {asset.token_address.slice(0, 6)}...{asset.token_address.slice(-4)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-transparent"
                              onClick={() => {
                                navigator.clipboard.writeText(asset.token_address!);
                                toast({ 
                                  title: "📋 Copied!", 
                                  description: `${asset.symbol} token address copied` 
                                });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${sentimentInfo.color}`}>
                          {sentimentInfo.label}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">Galaxy</span>
                        <Progress 
                          value={asset.galaxy_score} 
                          className="flex-1 h-2"
                        />
                        <span className={`text-xs font-medium w-8 ${getScoreColor(asset.galaxy_score)}`}>
                          {asset.galaxy_score.toFixed(0)}
                        </span>
                      </div>
                      
                      {asset.fomo_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">FOMO</span>
                          <Progress 
                            value={asset.fomo_score} 
                            className="flex-1 h-2"
                          />
                          <span className={`text-xs font-medium w-8 ${getScoreColor(asset.fomo_score)}`}>
                            {asset.fomo_score.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by LunarCrush</span>
            {generatedAt && (
              <span>Updated {new Date(generatedAt).toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}</span>
            )}
          </div>

          {/* Watermark (only visible during export) */}
          {isExporting && (
            <div className="absolute bottom-4 right-4 text-xs font-semibold text-primary opacity-70">
              XRayCrypto™ • @XRaycryptox
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
