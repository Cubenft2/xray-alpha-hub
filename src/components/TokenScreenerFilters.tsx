import { Search, X, TrendingUp, TrendingDown, Zap, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TokenScreenerFiltersProps {
  filters: {
    search: string;
    category: string;
    chain: string;
    tier: string;
    minVolume: string;
    minGalaxyScore: string;
    minMarketCap: string;
    changeFilter: 'all' | 'gainers' | 'losers';
    dataSource: 'all' | 'polygon' | 'lunarcrush';
    hideSuspicious: boolean;
  };
  onFilterChange: (key: string, value: string | boolean) => void;
  categories: string[];
  chains: string[];
}

const VOLUME_THRESHOLDS = [
  { value: '', label: 'Any Volume' },
  { value: '10000000', label: '> $10M' },
  { value: '100000000', label: '> $100M' },
  { value: '500000000', label: '> $500M' },
  { value: '1000000000', label: '> $1B' },
];

const GALAXY_THRESHOLDS = [
  { value: '', label: 'Any Score' },
  { value: '50', label: '50+' },
  { value: '60', label: '60+' },
  { value: '70', label: '70+' },
  { value: '80', label: '80+' },
];

const MARKET_CAP_THRESHOLDS = [
  { value: '', label: 'Any Cap' },
  { value: '10000000', label: '> $10M' },
  { value: '100000000', label: '> $100M' },
  { value: '1000000000', label: '> $1B' },
  { value: '10000000000', label: '> $10B' },
];

export function TokenScreenerFilters({ filters, onFilterChange, categories, chains }: TokenScreenerFiltersProps) {
  const hasActiveFilters = filters.search || filters.category || filters.chain || filters.tier || 
    filters.minVolume || filters.minGalaxyScore || filters.minMarketCap || filters.changeFilter !== 'all' || 
    filters.dataSource !== 'all' || !filters.hideSuspicious;

  const clearFilters = () => {
    onFilterChange('search', '');
    onFilterChange('category', '');
    onFilterChange('chain', '');
    onFilterChange('tier', '');
    onFilterChange('minVolume', '');
    onFilterChange('minGalaxyScore', '');
    onFilterChange('minMarketCap', '');
    onFilterChange('changeFilter', 'all');
    onFilterChange('dataSource', 'all');
    onFilterChange('hideSuspicious', true);
  };

  return (
    <div className="space-y-3">
      {/* First Row: Search + Gainers/Losers */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol or name..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Data Source Toggle */}
        <div className="flex gap-1">
          <Button
            variant={filters.dataSource === 'polygon' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('dataSource', filters.dataSource === 'polygon' ? 'all' : 'polygon')}
            className={cn(
              "gap-1",
              filters.dataSource === 'polygon' && "bg-green-600 hover:bg-green-700"
            )}
          >
            <Zap className="h-4 w-4" />
            LIVE
          </Button>
          <Button
            variant={filters.dataSource === 'lunarcrush' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('dataSource', filters.dataSource === 'lunarcrush' ? 'all' : 'lunarcrush')}
            className={cn(
              "gap-1",
              filters.dataSource === 'lunarcrush' && "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <Radio className="h-4 w-4" />
            LC
          </Button>
        </div>

        {/* Gainers/Losers Toggle */}
        <div className="flex gap-1">
          <Button
            variant={filters.changeFilter === 'gainers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('changeFilter', filters.changeFilter === 'gainers' ? 'all' : 'gainers')}
            className={cn(
              "gap-1",
              filters.changeFilter === 'gainers' && "bg-green-600 hover:bg-green-700"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Gainers
          </Button>
          <Button
            variant={filters.changeFilter === 'losers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('changeFilter', filters.changeFilter === 'losers' ? 'all' : 'losers')}
            className={cn(
              "gap-1",
              filters.changeFilter === 'losers' && "bg-red-600 hover:bg-red-700"
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Losers
          </Button>
        </div>

        {/* Hide Suspicious Toggle */}
        <Button
          variant={filters.hideSuspicious ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('hideSuspicious', !filters.hideSuspicious)}
          className={cn(
            "gap-1",
            filters.hideSuspicious && "bg-amber-600 hover:bg-amber-700"
          )}
          title="Hide tokens with suspicious market cap/volume ratios"
        >
          {filters.hideSuspicious ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {filters.hideSuspicious ? 'Protected' : 'Show All'}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Second Row: All Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Category Filter */}
        <Select value={filters.category || 'all'} onValueChange={(v) => onFilterChange('category', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.slice(0, 50).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Chain Filter */}
        <Select value={filters.chain || 'all'} onValueChange={(v) => onFilterChange('chain', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="Chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chains</SelectItem>
            {chains.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chain.charAt(0).toUpperCase() + chain.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tier Filter */}
        <Select value={filters.tier || 'all'} onValueChange={(v) => onFilterChange('tier', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="1">Tier 1 (Top 50)</SelectItem>
            <SelectItem value="2">Tier 2 (51-500)</SelectItem>
            <SelectItem value="3">Tier 3 (501-2000)</SelectItem>
            <SelectItem value="4">Tier 4 (2000+)</SelectItem>
          </SelectContent>
        </Select>

        {/* Volume Filter */}
        <Select value={filters.minVolume || ''} onValueChange={(v) => onFilterChange('minVolume', v)}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="Volume" />
          </SelectTrigger>
          <SelectContent>
            {VOLUME_THRESHOLDS.map((t) => (
              <SelectItem key={t.value || 'any'} value={t.value || 'any'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Galaxy Score Filter */}
        <Select value={filters.minGalaxyScore || ''} onValueChange={(v) => onFilterChange('minGalaxyScore', v)}>
          <SelectTrigger className="w-[110px] h-9 text-sm">
            <SelectValue placeholder="Galaxy" />
          </SelectTrigger>
          <SelectContent>
            {GALAXY_THRESHOLDS.map((t) => (
              <SelectItem key={t.value || 'any'} value={t.value || 'any'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Market Cap Filter */}
        <Select value={filters.minMarketCap || ''} onValueChange={(v) => onFilterChange('minMarketCap', v)}>
          <SelectTrigger className="w-[110px] h-9 text-sm">
            <SelectValue placeholder="Cap" />
          </SelectTrigger>
          <SelectContent>
            {MARKET_CAP_THRESHOLDS.map((t) => (
              <SelectItem key={t.value || 'any'} value={t.value || 'any'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
