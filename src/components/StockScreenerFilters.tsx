import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import { StockFilters, useStockFilters } from '@/hooks/useStockCards';

interface StockScreenerFiltersProps {
  filters: StockFilters;
  onFilterChange: (filters: Partial<StockFilters>) => void;
}

export function StockScreenerFilters({ filters, onFilterChange }: StockScreenerFiltersProps) {
  const { sectors } = useStockFilters();

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search symbol or name..."
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="pl-10"
        />
      </div>

      {/* Quick Filters Row */}
      <div className="flex flex-wrap gap-2">
        {/* Gainers/Losers Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <Button
            variant={filters.changeFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange({ changeFilter: 'all' })}
            className="rounded-none text-xs"
          >
            All
          </Button>
          <Button
            variant={filters.changeFilter === 'gainers' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange({ changeFilter: 'gainers' })}
            className="rounded-none text-xs"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Gainers
          </Button>
          <Button
            variant={filters.changeFilter === 'losers' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange({ changeFilter: 'losers' })}
            className="rounded-none text-xs"
          >
            <TrendingDown className="h-3 w-3 mr-1" />
            Losers
          </Button>
        </div>

        {/* Near 52W High/Low */}
        <Button
          variant={filters.near52WeekHigh ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange({ near52WeekHigh: !filters.near52WeekHigh, near52WeekLow: false })}
          className="text-xs"
        >
          <Target className="h-3 w-3 mr-1" />
          Near 52W High
        </Button>
        <Button
          variant={filters.near52WeekLow ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange({ near52WeekLow: !filters.near52WeekLow, near52WeekHigh: false })}
          className="text-xs"
        >
          <Target className="h-3 w-3 mr-1" />
          Near 52W Low
        </Button>
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Sector */}
        <Select value={filters.sector} onValueChange={(value) => onFilterChange({ sector: value })}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {sectors.filter(s => s !== 'all').map((sector) => (
              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Market Cap */}
        <Select value={filters.minMarketCap} onValueChange={(value) => onFilterChange({ minMarketCap: value })}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="Market Cap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Market Cap</SelectItem>
            <SelectItem value="1000000000">&gt; $1B</SelectItem>
            <SelectItem value="10000000000">&gt; $10B</SelectItem>
            <SelectItem value="100000000000">&gt; $100B</SelectItem>
            <SelectItem value="1000000000000">&gt; $1T</SelectItem>
          </SelectContent>
        </Select>

        {/* Volume */}
        <Select value={filters.minVolume} onValueChange={(value) => onFilterChange({ minVolume: value })}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="Volume" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Volume</SelectItem>
            <SelectItem value="100000">&gt; 100K</SelectItem>
            <SelectItem value="1000000">&gt; 1M</SelectItem>
            <SelectItem value="10000000">&gt; 10M</SelectItem>
            <SelectItem value="100000000">&gt; 100M</SelectItem>
          </SelectContent>
        </Select>

        {/* Technical Signal */}
        <Select value={filters.technicalSignal} onValueChange={(value) => onFilterChange({ technicalSignal: value })}>
          <SelectTrigger className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Signal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signals</SelectItem>
            <SelectItem value="strong_buy">Strong Buy</SelectItem>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
            <SelectItem value="strong_sell">Strong Sell</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
