import { RefreshCw } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { TokenScreenerTable } from '@/components/TokenScreenerTable';
import { TokenScreenerFilters } from '@/components/TokenScreenerFilters';
import { TokenScreenerInsights } from '@/components/TokenScreenerInsights';
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

  // Handle filter changes - clear 'all' and 'any' values
  const handleFilterChange = (key: string, value: string | boolean) => {
    if (typeof value === 'boolean') {
      updateFilter(key as any, value as any);
    } else {
      const cleanValue = value === 'all' || value === 'any' ? '' : value;
      updateFilter(key as any, cleanValue);
    }
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

  const startIndex = (currentPage - 1) * 100 + 1;
  const endIndex = Math.min(currentPage * 100, totalCount);

  return (
    <>
      <SEOHead
        title="Crypto Universe - 7,500+ Tokens"
        description="Explore 7,500+ cryptocurrencies with real-time prices, market cap, volume, Galaxy Score, social sentiment, and ZombieDog AI insights for smarter research."
        canonicalUrl="https://xraycrypto.io/crypto-universe"
        keywords="crypto screener, cryptocurrency prices, bitcoin, ethereum, altcoins, market cap, galaxy score, ZombieDog AI"
      />

      <div className="w-full px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">🌙 Crypto Universe</h1>
            <p className="text-muted-foreground">
              {totalCount.toLocaleString()} tokens • Real-time Polygon & LunarCrush data
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

        {/* Insights Panel */}
        <TokenScreenerInsights isLoading={isLoading} />

        {/* Filters */}
        <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
          <TokenScreenerFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            categories={categories}
            chains={chains}
          />
        </div>

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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border">
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
