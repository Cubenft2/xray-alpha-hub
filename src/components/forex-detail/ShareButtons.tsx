import React from 'react';
import { Button } from '@/components/ui/button';
import { Twitter, Link2, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonsProps {
  metal: 'silver' | 'gold' | 'platinum' | 'palladium';
  price?: number | null;
  metalName: string;
}

const metalIcons: Record<string, string> = {
  gold: '🥇',
  silver: '🥈',
  platinum: '⚪',
  palladium: '🔘'
};

export function ShareButtons({ metal, price, metalName }: ShareButtonsProps) {
  const { toast } = useToast();
  const pageUrl = `https://xraycrypto.io/forex/${metal}`;
  
  const getShareText = () => {
    const icon = metalIcons[metal] || '🥇';
    const priceText = price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    return `${icon} ${metalName} Deep Dive${priceText ? ` | ${priceText}` : ''} | Live price & CFTC bank positioning data on XRayCrypto`;
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent(pageUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied!",
        description: "Share URL copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${metalName} Deep Dive - XRayCrypto`,
          text: getShareText(),
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed silently
      }
    }
  };

  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTwitterShare}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Share on X"
      >
        <Twitter className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopyLink}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Copy link"
      >
        <Link2 className="h-4 w-4" />
      </Button>
      {supportsNativeShare && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNativeShare}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
