import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import gugoLandscape from '@/assets/gugo-landscape-new.jpeg';

export const SlidingBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this banner
    const dismissedKey = 'sliding_banner_dismissed_gugo';
    const wasDismissed = localStorage.getItem(dismissedKey);
    
    if (wasDismissed) {
      setIsDismissed(true);
      return;
    }

    // Wait for community promo to be dismissed
    const checkInterval = setInterval(() => {
      const isNowDismissed = localStorage.getItem('community_promo_dismissed');
      const dismissTime = localStorage.getItem('community_promo_dismissed_time');
      
      if (isNowDismissed && dismissTime) {
        clearInterval(checkInterval);
        // Show banner 60 seconds after community promo was dismissed
        const timeSinceDismissal = Date.now() - parseInt(dismissTime);
        const remainingTime = Math.max(0, 60000 - timeSinceDismissal);
        
        setTimeout(() => {
          setIsVisible(true);
        }, remainingTime);
      }
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    const dismissedKey = 'sliding_banner_dismissed_gugo';
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  };

  const handleBuyClick = () => {
    const chartUrl = 'https://www.defined.fi/abs/0xe59a3d6f77e6d0c5daf1da740ab65adc3b674012?quoteToken=token1&cache=faf95';
    window.open(chartUrl, '_blank', 'noopener,noreferrer');
  };

  if (isDismissed) return null;

  return (
    <div
      className={`fixed bottom-20 right-0 z-50 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ maxWidth: '90vw', width: '600px' }}
    >
      <div
        className="relative h-24 rounded-l-lg overflow-hidden shadow-2xl border-2 border-primary/40"
        style={{
          backgroundImage: `url(${gugoLandscape})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        
        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-white">$GUGO</span>
            <Button
              onClick={handleBuyClick}
              className="btn-hero text-sm h-10 px-6"
            >
              Buy Now
            </Button>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="ml-4 rounded-full bg-white/20 hover:bg-white/30 p-2 transition-colors"
            aria-label="Close banner"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Ad badge */}
        <div className="absolute top-2 left-2 bg-white/90 text-black text-xs font-bold px-2 py-0.5 rounded">
          Ad
        </div>
      </div>
    </div>
  );
};
