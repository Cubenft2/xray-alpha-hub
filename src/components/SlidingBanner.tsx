import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import gugoLandscape from '@/assets/gugo-landscape-new.jpeg';

export const SlidingBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const pageLoadTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Check if user has dismissed this banner
    const dismissedKey = 'sliding_banner_dismissed_gugo_v2';
    const wasDismissed = localStorage.getItem(dismissedKey);
    
    if (wasDismissed) {
      setIsDismissed(true);
      return;
    }

    // If community promo already dismissed in this session, schedule
    const dismissTime = localStorage.getItem('community_promo_dismissed_time');
    const isNowDismissed = localStorage.getItem('community_promo_dismissed');
    if (isNowDismissed && dismissTime) {
      const dismissedAt = parseInt(dismissTime);
      if (!Number.isNaN(dismissedAt) && dismissedAt >= pageLoadTimeRef.current) {
        const timeSinceDismissal = Date.now() - dismissedAt;
        const remainingTime = Math.max(0, 60000 - timeSinceDismissal);
        const timer = setTimeout(() => setIsVisible(true), remainingTime);
        return () => clearTimeout(timer);
      }
    }
    // Otherwise wait until it gets dismissed this session, then schedule
    const checkInterval = setInterval(() => {
      const isNowDismissed2 = localStorage.getItem('community_promo_dismissed');
      const dismissTime2 = localStorage.getItem('community_promo_dismissed_time');
      if (isNowDismissed2 && dismissTime2) {
        const dismissedAt = parseInt(dismissTime2);
        if (!Number.isNaN(dismissedAt) && dismissedAt >= pageLoadTimeRef.current) {
          clearInterval(checkInterval);
          const timeSinceDismissal = Date.now() - dismissedAt;
          const remainingTime = Math.max(0, 60000 - timeSinceDismissal);
          setTimeout(() => setIsVisible(true), remainingTime);
        }
      }
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  const handleDismiss = () => {
    console.log('[SlidingBanner] Close clicked');
    setIsVisible(false);
    const dismissedKey = 'sliding_banner_dismissed_gugo_v2';
    localStorage.setItem(dismissedKey, 'true');
    setIsDismissed(true);
  };

  const handleBuyClick = () => {
    const chartUrl = 'https://runwithgugo.com/market';
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
        <div className="absolute inset-0 pointer-events-none bg-black/40 backdrop-blur-[2px]" />
        
        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-between px-6 pointer-events-auto">
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
            type="button"
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
