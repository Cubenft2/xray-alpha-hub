import { useState, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import { PriceUpdate } from '@/hooks/useWebSocketPrices';

interface LivePriceProps {
  priceData: PriceUpdate | null;
  className?: string;
  showSymbol?: boolean;
  showChange?: boolean;
  size?: 'sm' | 'md' | 'lg';
  formatOptions?: Intl.NumberFormatOptions;
}

type FlashState = 'none' | 'up' | 'down';

export const LivePrice = memo(function LivePrice({
  priceData,
  className,
  showSymbol = false,
  showChange = false,
  size = 'md',
  formatOptions,
}: LivePriceProps) {
  const [flash, setFlash] = useState<FlashState>('none');
  const [prevPrice, setPrevPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!priceData) return;

    // Check if price changed
    if (prevPrice !== null && priceData.price !== prevPrice) {
      const direction = priceData.price > prevPrice ? 'up' : 'down';
      setFlash(direction);

      // Reset flash after animation
      const timeout = setTimeout(() => setFlash('none'), 300);
      return () => clearTimeout(timeout);
    }

    setPrevPrice(priceData.price);
  }, [priceData?.price, prevPrice]);

  if (!priceData) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        --
      </span>
    );
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  const defaultFormatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: priceData.price < 1 ? 6 : 2,
    ...formatOptions,
  };

  const formattedPrice = new Intl.NumberFormat('en-US', defaultFormatOptions)
    .format(priceData.price);

  const changeColor = priceData.change24h 
    ? priceData.change24h >= 0 ? 'text-success' : 'text-destructive'
    : '';

  return (
    <span
      className={cn(
        'font-mono inline-flex items-center gap-2 rounded px-1 transition-colors duration-150',
        sizeClasses[size],
        flash === 'up' && 'animate-flash-green',
        flash === 'down' && 'animate-flash-red',
        className
      )}
    >
      {showSymbol && (
        <span className="text-muted-foreground">{priceData.symbol}</span>
      )}
      <span>{formattedPrice}</span>
      {showChange && priceData.change24h !== undefined && (
        <span className={cn('text-xs', changeColor)}>
          {priceData.change24h >= 0 ? '+' : ''}
          {priceData.change24h.toFixed(2)}%
        </span>
      )}
    </span>
  );
});
