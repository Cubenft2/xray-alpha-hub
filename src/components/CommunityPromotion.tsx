import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, TrendingUp, Users, Sparkles, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import gugoAnimated from "@/assets/gugo-animated.gif";

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
  title: '🚀 Community Spotlight: $GUGO',
  subtitle: 'Early Access to Abstract Chain Gem',
  description: '$GUGO is an emerging memecoin on Abstract Chain, Ethereum L2.',
  token: {
    symbol: 'GUGO',
    name: 'GUGO Token',
    chain: 'Abstract Chain',
    chainColor: 'hsl(280 100% 70%)'
  },
  links: {
    chart: 'https://www.defined.fi/abs/0xe59a3d6f77e6d0c5daf1da740ab65adc3b674012?quoteToken=token1&cache=faf95',
    website: 'https://linktr.ee/runwithgugo?utm_source=linktree_profile_share&ltsid=2f8e530e-f1d5-4feb-8338-1d81465bcdbd',
    twitter: 'https://x.com/runwithgugo',
    community: 'https://x.com/TypeMediaX'
  },
  features: [
    'Abstract Chain (Ethereum L2)',
    'Early stage opportunity',
    'Community-driven'
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

    // Show popup after 60 seconds if not dismissed
    const timer = setTimeout(() => {
      if (!dismissed) {
        setIsOpen(true);
      }
    }, 60000);

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
      <DialogContent className="max-w-[90vw] sm:max-w-xs mx-auto bg-card border border-primary/20 shadow-xl max-h-[85vh] overflow-y-auto overflow-hidden">
        {/* Animated Background */}
        <div 
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `url(${gugoAnimated})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Content Overlay */}
        <div className="relative z-10">
          {/* Close Button */}
          <button
            onClick={() => handleDismiss(false)}
            className="absolute right-3 top-3 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>

        <DialogHeader className="text-center space-y-1 sm:space-y-2 pr-8">
          <div className="flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-accent animate-pulse" />
          </div>
          
          <DialogTitle className="text-base sm:text-lg font-bold xr-gradient-text leading-tight">
            {CURRENT_PROMOTION.title}
          </DialogTitle>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
            <Badge 
              variant="secondary" 
              className="bg-accent/60 text-accent-foreground border-accent/80 xr-glow-accent animate-glow-pulse font-bold text-[10px]"
            >
              <Users className="h-2.5 w-2.5 mr-1" />
              Community Pick
            </Badge>
            <Badge 
              variant="outline"
              style={{ borderColor: CURRENT_PROMOTION.token.chainColor, color: CURRENT_PROMOTION.token.chainColor }}
              className="xr-xray-glow animate-glow-pulse text-[10px]"
            >
              {CURRENT_PROMOTION.token.chain}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {/* Token Info */}
          <div className="w-full flex flex-col items-center justify-center p-2 rounded-lg border border-primary/30 bg-card/60 backdrop-blur-sm">
            <div className="text-lg font-bold text-primary mb-0.5 text-center w-full">
              ${CURRENT_PROMOTION.token.symbol}
            </div>
            <div className="text-xs text-muted-foreground text-center w-full">
              {CURRENT_PROMOTION.token.name}
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground text-center leading-relaxed px-1">
            {CURRENT_PROMOTION.description}
          </p>

          {/* Features - Condensed */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1 justify-center">
              <TrendingUp className="h-3 w-3 text-success" />
              Key Highlights:
            </div>
            <div className="grid grid-cols-1 gap-0.5 text-[10px]">
              {CURRENT_PROMOTION.features.map((feature, index) => (
                <div key={index} className="text-muted-foreground flex items-start gap-1.5 justify-center">
                  <span className="text-accent">•</span>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              {CURRENT_PROMOTION.links.chart && (
                <Button
                  onClick={() => handleLinkClick(
                    CURRENT_PROMOTION.links.chart!, 
                    'Defined.fi Chart'
                  )}
                  className="btn-hero text-[10px] h-7 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Chart
                </Button>
              )}
              {CURRENT_PROMOTION.links.website && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.website!, 'Abstract website')}
                  className="text-[10px] h-7 border-primary/30 hover:bg-primary/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Learn
                </Button>
              )}
            </div>
            
            {/* Social Links */}
            <div className="grid grid-cols-2 gap-1.5">
              {CURRENT_PROMOTION.links.twitter && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.twitter!, 'GUGO Twitter')}
                  className="text-[10px] h-7 border-accent/30 hover:bg-accent/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Twitter
                </Button>
              )}
              {CURRENT_PROMOTION.links.community && (
                <Button
                  variant="outline"
                  onClick={() => handleLinkClick(CURRENT_PROMOTION.links.community!, 'Type Media Community')}
                  className="text-[10px] h-7 border-accent/30 hover:bg-accent/10 w-full"
                >
                  <ExternalLink className="h-2.5 w-2.5 mr-1" />
                  Community
                </Button>
              )}
            </div>
          </div>

          {/* Disclaimer - Condensed */}
          <div className="text-[10px] text-muted-foreground/80 text-center p-1.5 bg-warning/10 rounded border border-warning/20">
            ⚠️ <strong>DYOR:</strong> Not financial advice.
          </div>

          {/* Quick Dismiss */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border">
            <Button
              onClick={() => handleDismiss(false)}
              variant="secondary"
              className="text-[10px] h-7 w-full"
            >
              Close
            </Button>
            <Button
              onClick={() => handleDismiss(true)}
              variant="outline"
              className="text-[10px] h-7 w-full"
            >
              Don't show
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};