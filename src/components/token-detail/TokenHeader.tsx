import { ArrowLeft, Star, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface TokenHeaderProps {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  tier: number | null;
  marketCapRank: number | null;
  categories: string[] | null;
}

export function TokenHeader({ symbol, name, logoUrl, tier, marketCapRank, categories }: TokenHeaderProps) {
  const navigate = useNavigate();

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
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-3 flex-1">
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt={`${symbol} logo`} 
            className="h-12 w-12 rounded-full"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">{symbol}</h1>
            <span className="text-xl text-muted-foreground">{name || 'Unknown'}</span>
            {getTierBadge(tier)}
            {marketCapRank && (
              <Badge variant="secondary">Rank #{marketCapRank}</Badge>
            )}
          </div>
          {categories && categories.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {categories.slice(0, 4).map((cat, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
