import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TokenScreenerFiltersProps {
  filters: {
    search: string;
    category: string;
    chain: string;
    tier: string;
  };
  onFilterChange: (key: 'search' | 'category' | 'chain' | 'tier', value: string) => void;
  categories: string[];
  chains: string[];
}

export function TokenScreenerFilters({ filters, onFilterChange, categories, chains }: TokenScreenerFiltersProps) {
  const hasActiveFilters = filters.search || filters.category || filters.chain || filters.tier;

  const clearFilters = () => {
    onFilterChange('search', '');
    onFilterChange('category', '');
    onFilterChange('chain', '');
    onFilterChange('tier', '');
  };

  return (
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

      {/* Category Filter */}
      <Select value={filters.category} onValueChange={(v) => onFilterChange('category', v)}>
        <SelectTrigger className="w-[160px]">
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
      <Select value={filters.chain} onValueChange={(v) => onFilterChange('chain', v)}>
        <SelectTrigger className="w-[140px]">
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
      <Select value={filters.tier} onValueChange={(v) => onFilterChange('tier', v)}>
        <SelectTrigger className="w-[120px]">
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

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
