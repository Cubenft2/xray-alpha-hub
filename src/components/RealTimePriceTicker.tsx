import { useUnifiedPrices } from '@/hooks/useUnifiedPrices';
import { Card, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RealTimePriceTickerProps {
  symbols?: string[];
  className?: string;
}

export function RealTimePriceTicker({ 
  symbols = ['BTC', 'ETH', 'SOL', 'AVAX'], 
  className = '' 
}: RealTimePriceTickerProps) {
  const { data, isLoading, error } = useUnifiedPrices(symbols);

  return (
    <Card className={className} style={{ minHeight: '140px' }}>
      <CardContent className='p-2 relative'>
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
            <div className='flex items-center gap-2'>
              <Activity className='h-4 w-4 animate-spin' />
              <p className='text-sm text-muted-foreground'>Loading real-time prices...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
            <p className='text-sm text-destructive'>Failed to load real-time prices</p>
          </div>
        )}

        <div className='flex items-center justify-between mb-1.5'>
          <div className='flex items-center gap-2'>
            <Activity className='h-3 w-3 text-green-500 animate-pulse' />
            <span className='text-[10px] font-medium text-muted-foreground'>LIVE PRICES</span>
          </div>
          <Badge variant='outline' className='text-[9px] px-1.5 py-0 h-4'>Updates every 5s</Badge>
        </div>

        <div className='grid grid-cols-3 md:grid-cols-6 gap-2'>
          {data?.prices.map((priceData) => (
            <div key={priceData.symbol} className='space-y-0'>
              <div className='flex items-center gap-1'>
                <span className='text-[10px] font-medium text-muted-foreground'>
                  {priceData.symbol}
                  {priceData.type === 'stock' && <span className='ml-0.5 text-[8px]'>📈</span>}
                </span>
              </div>
              
              <div className='flex items-baseline gap-1'>
                <span className='text-sm font-bold'>
                  {'$'}{priceData.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
                <span className={`text-[9px] ${priceData.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceData.change24h >= 0 ? '+' : ''}{priceData.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className='mt-1.5'>
          <p className='text-[9px] text-muted-foreground text-center'>
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
