import { Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useFavorites';
import { SEOHead } from '@/components/SEOHead';

export default function Favorites() {
  const { favorites } = useFavorites();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['favorite-tokens', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];

      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, name, logo_url, price_usd, change_24h_pct, galaxy_score, market_cap_rank')
        .in('canonical_symbol', favorites);

      if (error) throw error;
      return data || [];
    },
    enabled: favorites.length > 0,
  });

  const formatPrice = (price: number | null) => {
    if (!price) return '-';
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(6)}`;
  };

  return (
    <>
      <SEOHead 
        title="Favorites | XRay Crypto"
        description="Your starred cryptocurrency tokens"
        noIndex={true}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <h1 className="text-3xl font-bold">Favorites</h1>
          <Badge variant="secondary" className="ml-2">
            {favorites.length} tokens
          </Badge>
        </div>

        {favorites.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
              <p className="text-muted-foreground mb-4">
                Click the star icon on any token to add it to your favorites
              </p>
              <Link 
                to="/crypto-universe" 
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Browse tokens <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: favorites.length }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens?.map((token) => (
              <Link 
                key={token.canonical_symbol}
                to={`/crypto-universe/${token.canonical_symbol}`}
              >
                <Card className="hover:border-primary/50 transition-all hover:shadow-lg group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {token.logo_url ? (
                        <img 
                          src={token.logo_url} 
                          alt={token.name || token.canonical_symbol}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                          {token.canonical_symbol?.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{token.canonical_symbol}</span>
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">{token.name}</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <div className="text-lg font-bold">{formatPrice(token.price_usd)}</div>
                        {token.change_24h_pct !== null && (
                          <div className={`text-sm ${token.change_24h_pct >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                            {token.change_24h_pct >= 0 ? '+' : ''}{token.change_24h_pct.toFixed(2)}%
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {token.market_cap_rank && <div>Rank #{token.market_cap_rank}</div>}
                        {token.galaxy_score && <div>GS: {token.galaxy_score.toFixed(1)}</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
