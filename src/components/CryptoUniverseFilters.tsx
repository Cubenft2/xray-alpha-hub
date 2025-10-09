import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filters } from '@/hooks/useLunarCrushUniverse';

interface CryptoUniverseFiltersProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
}

export function CryptoUniverseFilters({ filters, setFilters }: CryptoUniverseFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center bg-muted/50 p-4 rounded-lg">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by symbol or name..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
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
        >
          Gainers
        </Button>
        <Button
          variant={filters.changeFilter === 'losers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({ ...filters, changeFilter: 'losers' })}
        >
          Losers
        </Button>
      </div>
    </div>
  );
}
