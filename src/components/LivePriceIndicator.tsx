import { cn } from '@/lib/utils';

interface LivePriceIndicatorProps {
  isConnected: boolean;
  className?: string;
  showLabel?: boolean;
}

export function LivePriceIndicator({ 
  isConnected, 
  className,
  showLabel = true 
}: LivePriceIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      <span 
        className={cn(
          'w-2 h-2 rounded-full',
          isConnected 
            ? 'bg-success animate-pulse' 
            : 'bg-muted-foreground'
        )}
      />
      {showLabel && (
        <span className={cn(
          'font-mono',
          isConnected ? 'text-success' : 'text-muted-foreground'
        )}>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      )}
    </div>
  );
}
