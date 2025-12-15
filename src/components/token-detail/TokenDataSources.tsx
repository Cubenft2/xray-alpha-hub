import { Database, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TokenDataSourcesProps {
  tier: number | null;
  priceUpdatedAt: string | null;
  socialUpdatedAt: string | null;
  technicalsUpdatedAt: string | null;
  securityUpdatedAt: string | null;
  newsUpdatedAt: string | null;
  hasPolygonData: boolean;
  hasLunarCrushData: boolean;
  hasCoingeckoData: boolean;
  hasSecurityData: boolean;
}

export function TokenDataSources({
  tier,
  priceUpdatedAt,
  socialUpdatedAt,
  technicalsUpdatedAt,
  securityUpdatedAt,
  newsUpdatedAt,
  hasPolygonData,
  hasLunarCrushData,
  hasCoingeckoData,
  hasSecurityData,
}: TokenDataSourcesProps) {
  const sources = [
    { name: 'Polygon', active: hasPolygonData },
    { name: 'LunarCrush', active: hasLunarCrushData },
    { name: 'CoinGecko', active: hasCoingeckoData },
    { name: 'Security', active: hasSecurityData },
  ];

  const activeSources = sources.filter(s => s.active).length;
  const fidelityScore = Math.round((activeSources / sources.length) * 10);

  const formatTime = (date: string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return null;
    }
  };

  return (
    <div className="border-t pt-4 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        {/* Data Sources */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground flex items-center gap-1">
            <Database className="h-4 w-4" />
            DATA SOURCES:
          </span>
          {sources.map((source) => (
            <span key={source.name} className="flex items-center gap-1">
              {source.active ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={source.active ? 'text-foreground' : 'text-muted-foreground'}>
                {source.name}
              </span>
            </span>
          ))}
        </div>

        {/* Fidelity Score */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>Fidelity Score: <span className="text-foreground font-medium">{fidelityScore}/10</span></span>
          {tier && <span>• Tier {tier}</span>}
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
        {priceUpdatedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Price: {formatTime(priceUpdatedAt)}
          </span>
        )}
        {socialUpdatedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Social: {formatTime(socialUpdatedAt)}
          </span>
        )}
        {technicalsUpdatedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Technicals: {formatTime(technicalsUpdatedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
