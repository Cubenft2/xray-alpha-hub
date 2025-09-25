import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, TrendingUp, Users, Sparkles, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import gugoMascot from "@/assets/gugo-mascot.jpg";

interface PromotionData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  token: {
    symbol: string;
    name: string;
    chain: string;
    chainColor: string;
  };
  links: {
    buy?: string;
    chart?: string;
    chartAlt?: string;
    chartAlt2?: string;
    website?: string;
    twitter?: string;
    community?: string;
  };
  features: string[];
  isActive: boolean;
}

const CURRENT_PROMOTION: PromotionData = {
  id: 'gugo_abstract_2025',
  title: '🦆 Run With $GUGO',
  subtitle: 'The Ultimate Meme Coin Movement',
  description: 'Born in a pool. Forged by loss. Sustained by motion. He runs. Join the $GUGO movement - a community that never stops running.',
  token: {
    symbol: 'GUGO',
    name: 'Run With GUGO',
    chain: 'Abstract Chain',
    chainColor: 'hsl(280 100% 70%)'
  },
  links: {
    buy: 'https://runwithgugo.com/buy-gugo',
    chart: 'https://www.defined.fi/abs/0xe59a3d6f77e6d0c5daf1da740ab65adc3b674012?quoteToken=token1&cache=faf95',
    website: 'https://runwithgugo.com/',
    twitter: 'https://x.com/runwithgugo',
    community: 'https://x.com/TypeMediaX'
  },
  features: [
    'Community movement with shared purpose',
    'Meme sharing platform for runners',
    'Decentralized governance & collective action',
    '5,000+ holders and growing'
  ],
  isActive: true
};

export const CommunityPromotion: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!CURRENT_PROMOTION.isActive) return;

    // Check if user has dismissed this promotion
    const dismissedKey = `promotion_dismissed_${CURRENT_PROMOTION.id}`;
    const wasDismissed = localStorage.getItem(dismissedKey);
    
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Show popup after 3 seconds if not dismissed
    const timer = setTimeout(() => {
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismiss = (remember: boolean = false) => {
    setIsOpen(false);
    if (remember) {
      const dismissedKey = `promotion_dismissed_${CURRENT_PROMOTION.id}`;
      localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually",
        variant: "destructive"
      });
    });
  };

  const handleLinkClick = (url: string, type: string, fallbackUrl?: string, fallbackUrl2?: string) => {
    // Copy URL to clipboard as backup
    copyToClipboard(url, type);
    
    try {
      // Open URL directly in new tab
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        toast({
          title: "Opening chart",
          description: `Redirecting to ${type}...`,
        });
      } else {
        throw new Error('Popup blocked');
      }
    } catch (error) {
      console.error('Failed to open link:', error);
      toast({
        title: "Link copied instead",
        description: `URL copied to clipboard - paste in new tab`,
      });
    }
  };

  if (!CURRENT_PROMOTION.isActive || dismissed) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-sm mx-auto bg-card border border-primary/20 shadow-xl max-h-[80vh] overflow-y-auto w-[90vw] sm:w-full sm:max-w-md">
        <DialogHeader className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-accent animate-pulse" />
          </div>
          
          <DialogTitle className="text-xl font-bold xr-gradient-text leading-tight">
            {CURRENT_PROMOTION.title}
          </DialogTitle>
          
          <div className="flex items-center justify-center gap-2">
            <Badge 
              variant="secondary" 
              className="bg-accent/60 text-accent-foreground border-accent/80 xr-glow-accent animate-glow-pulse font-bold"
            >
              <Users className="h-3 w-3 mr-1" />
              Community Pick
            </Badge>
            <Badge 
              variant="outline"
              style={{ borderColor: CURRENT_PROMOTION.token.chainColor, color: CURRENT_PROMOTION.token.chainColor }}
              className="xr-xray-glow animate-glow-pulse"
            >
              {CURRENT_PROMOTION.token.chain}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* GUGO Mascot Image */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 shadow-lg">
              <img 
                src={gugoMascot} 
                alt="GUGO Token Mascot" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Token Info */}
          <div className="text-center p-4 bg-muted/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-primary mb-1">
              ${CURRENT_PROMOTION.token.symbol}
            </div>
            <div className="text-sm text-muted-foreground">
              {CURRENT_PROMOTION.token.name}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {CURRENT_PROMOTION.description}
          </p>

          {/* Features */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Key Highlights:
            </div>
            <ul className="space-y-1">
              {CURRENT_PROMOTION.features.map((feature, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {/* Primary Buy Button */}
            {CURRENT_PROMOTION.links.buy && (
              <Button
                onClick={() => handleLinkClick(CURRENT_PROMOTION.links.buy!, 'Buy GUGO')}
                className="btn-hero w-full text-sm h-11 font-semibold"
              >
                <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                🦆 Run With GUGO - Buy Now
              </Button>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              {CURRENT_PROMOTION.links.chart && (
                <Button
                  onClick={() => handleLinkClick(
                    CURRENT_PROMOTION.links.chart!, 
                    'Defined.fi Chart'
                  )}
                  className="btn-hero text-xs h-10 px-2 whitespace-nowrap text-center flex items-center justify-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Chart</span>
                </Button>
              )}
              {CURRENT_PROMOTION.links.website && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.website!, 'GUGO Website')}
                  className="text-xs h-10 px-2 border-primary/30 hover:bg-primary/10 whitespace-nowrap text-center flex items-center justify-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Website</span>
                </Button>
              )}
            </div>
            
            {/* Social Links */}
            <div className="grid grid-cols-2 gap-2">
              {CURRENT_PROMOTION.links.twitter && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.twitter!, 'GUGO Twitter')}
                  className="text-xs h-10 px-2 border-accent/30 hover:bg-accent/10 whitespace-nowrap text-center flex items-center justify-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Twitter</span>
                </Button>
              )}
              {CURRENT_PROMOTION.links.community && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.community!, 'Type Media Community')}
                  className="text-xs h-10 px-2 border-accent/30 hover:bg-accent/10 whitespace-nowrap text-center flex items-center justify-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Community</span>
                </Button>
              )}
            </div>
            
            {/* Manual Copy Option */}
            <div className="text-xs text-muted-foreground text-center">
              <p className="mb-2">Link not opening? Copy manually:</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(CURRENT_PROMOTION.links.buy!, 'Buy GUGO URL')}
                className="h-7 px-2 text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Buy Link
              </Button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground/80 text-center p-3 bg-warning/10 rounded border border-warning/20">
            ⚠️ <strong>DYOR:</strong> This is a community spotlight, not financial advice. 
            Always research before investing in any cryptocurrency.
          </div>

          {/* Dismiss Options */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(true)}
              className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
            >
              Don't show again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(false)}
              className="text-xs w-full sm:w-auto"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};