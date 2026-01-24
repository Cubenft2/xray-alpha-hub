import { ArrowLeft, Star, Award, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '@/hooks/useFavorites';

interface TokenHeaderProps {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  tier: number | null;
  marketCapRank: number | null;
  categories: string[] | null;
  priceUsd?: number | null;
  change24hPct?: number | null;
}

export function TokenHeader({ 
  symbol, 
  name, 
  logoUrl, 
  tier, 
  marketCapRank, 
  categories,
  priceUsd,
  change24hPct,
}: TokenHeaderProps) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(symbol);

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(8)}`;
  };

  const getTierBadge = (tier: number | null) => {
    if (!tier) return null;
    const tierColors: Record<number, string> = {
      1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      2: 'bg-slate-400/20 text-slate-300 border-slate-400/50',
      3: 'bg-orange-600/20 text-orange-400 border-orange-600/50',
      4: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <Badge variant="outline" className={`${tierColors[tier] || tierColors[4]} flex items-center gap-1`}>
        {tier === 1 && <Star className="h-3 w-3 fill-current" />}
        {tier === 2 && <Award className="h-3 w-3" />}
        Tier {tier}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      {/* Back button */}
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Logo */}
      {logoUrl && (
        <img 
          src={logoUrl} 
          alt={`${symbol} logo`} 
          className="h-14 w-14 rounded-full shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold">{symbol}</h1>
          <span className="text-lg text-muted-foreground">{name || 'Unknown'}</span>
          
          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavorite(symbol)}
            className={`h-8 w-8 ${isFav ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
          >
            <Star className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
          </Button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {getTierBadge(tier)}
          {marketCapRank && (
            <Badge variant="secondary">Rank #{marketCapRank}</Badge>
          )}
          {categories && categories.slice(0, 3).map((cat, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Price Section */}
      <div className="sm:text-right shrink-0">
        <div className="text-2xl sm:text-3xl font-bold">{formatPrice(priceUsd)}</div>
        {change24hPct !== null && change24hPct !== undefined && (
          <div className={`flex items-center gap-1 text-lg ${
            change24hPct >= 0 ? 'text-green-500' : 'text-destructive'
          }`}>
            {change24hPct >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            <span>{change24hPct >= 0 ? '+' : ''}{change24hPct.toFixed(2)}%</span>
            <span className="text-sm text-muted-foreground">24h</span>
          </div>
        )}
      </div>
    </div>
  );
}
