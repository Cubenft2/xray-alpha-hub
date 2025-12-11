import { Search, RefreshCw, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterState, DEFAULT_FILTERS } from '@/hooks/useLunarCrushUniverse';

interface CryptoUniverseFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  totalCount?: number;
  lastUpdated?: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'layer-1', label: 'Layer 1' },
  { value: 'defi', label: 'DeFi' },
  { value: 'meme', label: 'Meme' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'nft', label: 'NFT' },
  { value: 'stablecoin', label: 'Stablecoins' },
  { value: 'ai', label: 'AI' },
  { value: 'exchange', label: 'Exchange Tokens' },
];

const VOLUME_THRESHOLDS = [
  { value: '0', label: 'Any Volume' },
  { value: '10000000', label: '>$10M' },
  { value: '100000000', label: '>$100M' },
  { value: '500000000', label: '>$500M' },
  { value: '1000000000', label: '>$1B' },
];

const GALAXY_SCORE_THRESHOLDS = [
  { value: '0', label: 'Any Score' },
  { value: '50', label: '50+' },
  { value: '60', label: '60+' },
  { value: '70', label: '70+' },
  { value: '80', label: '80+' },
];

const MARKET_CAP_THRESHOLDS = [
  { value: '0', label: 'Any Cap' },
  { value: '10000000', label: '>$10M' },
  { value: '100000000', label: '>$100M' },
  { value: '1000000000', label: '>$1B' },
  { value: '10000000000', label: '>$10B' },
];

export function CryptoUniverseFilters({
  filters,
  setFilters,
  onRefresh,
  isLoading,
  totalCount,
  lastUpdated,
}: CryptoUniverseFiltersProps) {
  const hasActiveFilters = 
    filters.search !== '' ||
    filters.category !== 'all' ||
    filters.minVolume > 0 ||
    filters.minGalaxyScore > 0 ||
    filters.minMarketCap > 0 ||
    filters.changeFilter !== 'all';

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center bg-muted/50 p-4 rounded-lg">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol or name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Category */}
        <Select
          value={filters.category}
          onValueChange={(value) => setFilters({ ...filters, category: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Volume threshold */}
        <Select
          value={filters.minVolume.toString()}
          onValueChange={(value) => setFilters({ ...filters, minVolume: parseInt(value) })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Volume" />
          </SelectTrigger>
          <SelectContent>
            {VOLUME_THRESHOLDS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Galaxy Score threshold */}
        <Select
          value={filters.minGalaxyScore.toString()}
          onValueChange={(value) => setFilters({ ...filters, minGalaxyScore: parseInt(value) })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Galaxy" />
          </SelectTrigger>
          <SelectContent>
            {GALAXY_SCORE_THRESHOLDS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Market Cap threshold */}
        <Select
          value={filters.minMarketCap.toString()}
          onValueChange={(value) => setFilters({ ...filters, minMarketCap: parseInt(value) })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Cap" />
          </SelectTrigger>
          <SelectContent>
            {MARKET_CAP_THRESHOLDS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Gainers/Losers toggle */}
        <div className="flex gap-1">
          <Button
            variant={filters.changeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, changeFilter: 'all' })}
          >
            All
          </Button>
          <Button
            variant={filters.changeFilter === 'gainers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, changeFilter: 'gainers' })}
            className={filters.changeFilter === 'gainers' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            📈 Gainers
          </Button>
          <Button
            variant={filters.changeFilter === 'losers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilters({ ...filters, changeFilter: 'losers' })}
            className={filters.changeFilter === 'losers' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            📉 Losers
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-center">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          {totalCount !== undefined && (
            <span>{totalCount.toLocaleString()} tokens found</span>
          )}
          {hasActiveFilters && (
            <span className="text-primary">• Filters active</span>
          )}
        </div>
        {lastUpdated && (
          <span>Updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
