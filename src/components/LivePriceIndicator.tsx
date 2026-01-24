import { cn } from '@/lib/utils';

interface LivePriceIndicatorProps {
  isConnected: boolean;
  className?: string;
  showLabel?: boolean;
  priceCount?: number;
  isFallbackMode?: boolean;
}

export function LivePriceIndicator({ 
  isConnected, 
  className,
  showLabel = true,
  priceCount,
  isFallbackMode = false,
}: LivePriceIndicatorProps) {
  const getStatusColor = () => {
    if (isFallbackMode) return 'bg-amber-500';
    if (isConnected) return 'bg-success animate-pulse';
    return 'bg-muted-foreground';
  };

  const getStatusText = () => {
    if (isFallbackMode) return 'REST';
    if (isConnected) return priceCount ? `LIVE (${priceCount})` : 'LIVE';
    return 'OFFLINE';
  };

  const getTextColor = () => {
    if (isFallbackMode) return 'text-amber-500';
    if (isConnected) return 'text-success';
    return 'text-muted-foreground';
  };

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      <span className={cn('w-2 h-2 rounded-full', getStatusColor())} />
      {showLabel && (
        <span className={cn('font-mono', getTextColor())}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
}
