import { usePolygonPrices } from '@/hooks/usePolygonPrices';
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
  const { data, isLoading, error } = usePolygonPrices(symbols);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className='p-4'>
          <p className='text-sm text-destructive'>Failed to load real-time prices</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className='p-4'>
          <div className='flex items-center gap-2'>
            <Activity className='h-4 w-4 animate-spin' />
            <p className='text-sm text-muted-foreground'>Loading real-time prices...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <Activity className='h-4 w-4 text-green-500 animate-pulse' />
            <span className='text-xs font-medium text-muted-foreground'>LIVE from Polygon.io</span>
          </div>
          <Badge variant='outline' className='text-xs'>Updates every 10s</Badge>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {data?.prices.map((priceData) => (
            <div key={priceData.symbol} className='space-y-1'>
              <div className='flex items-center gap-1'>
                <span className='text-xs font-medium text-muted-foreground'>{priceData.symbol}</span>
              </div>
              
              <div className='flex items-baseline gap-2'>
                <span className='text-lg font-bold'>
                  {'$'}{priceData.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              <div className='flex items-center gap-1'>
                <span className='text-xs text-muted-foreground'>{priceData.exchange}</span>
                <span className='text-xs text-muted-foreground'>•</span>
                <span className='text-xs text-muted-foreground'>
                  {new Date(priceData.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className='mt-3 pt-3 border-t'>
          <p className='text-xs text-muted-foreground text-center'>
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
