import { RefreshCw } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { TokenScreenerTable } from '@/components/TokenScreenerTable';
import { TokenScreenerFilters } from '@/components/TokenScreenerFilters';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { useTokenCards, useTokenFilters } from '@/hooks/useTokenCards';
import { cn } from '@/lib/utils';

export default function Screener() {
  const {
    tokens,
    totalCount,
    totalPages,
    currentPage,
    setCurrentPage,
    sortKey,
    sortDirection,
    handleSort,
    filters,
    updateFilter,
    isLoading,
    isFetching,
    refetch,
  } = useTokenCards();

  const { categories, chains } = useTokenFilters();

  // Handle filter changes - clear 'all' values
  const handleFilterChange = (key: 'search' | 'category' | 'chain' | 'tier', value: string) => {
    updateFilter(key, value === 'all' ? '' : value);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) pages.push('ellipsis');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const startIndex = (currentPage - 1) * 250 + 1;
  const endIndex = Math.min(currentPage * 250, totalCount);

  return (
    <>
      <SEOHead
        title="Crypto Screener"
        description="Screen 7,500+ cryptocurrencies with real-time prices, market cap, volume, Galaxy Score, and social sentiment data."
      />

      <div className="w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Crypto Screener</h1>
            <p className="text-muted-foreground">
              {totalCount.toLocaleString()} tokens • Auto-refreshes every 30s
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <TokenScreenerFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          categories={categories}
          chains={chains}
        />

        {/* Table */}
        <TokenScreenerTable
          tokens={tokens}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex.toLocaleString()} - {endIndex.toLocaleString()} of {totalCount.toLocaleString()}
            </p>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>

                {getPageNumbers().map((page, idx) => (
                  <PaginationItem key={idx}>
                    {page === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </>
  );
}
