import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useStockCards } from '@/hooks/useStockCards';
import { StockScreenerFilters } from '@/components/StockScreenerFilters';
import { StockScreenerTable } from '@/components/StockScreenerTable';
import { SEOHead } from '@/components/SEOHead';

export default function StockScreener() {
  const {
    stocks,
    totalCount,
    pageCount,
    page,
    setPage,
    sortKey,
    sortDirection,
    handleSort,
    filters,
    updateFilters,
    isLoading,
    refetch,
  } = useStockCards();

  return (
    <>
      <SEOHead 
        title="Stock Screener - Technical & Fundamental Analysis"
        description="Screen and filter stocks with real-time prices, technical indicators (RSI, MACD), fundamentals (P/E ratio, dividend yield), and 52-week range analysis."
        canonicalUrl="https://xraycrypto.io/stocks"
        keywords="stock screener, stock analysis, NYSE, NASDAQ, technical indicators, RSI, MACD, P/E ratio"
      />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" />
              Stock Universe
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount.toLocaleString()} stocks • Real-time Polygon data • Technicals & Fundamentals
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StockScreenerFilters filters={filters} onFilterChange={updateFilters} />
          </CardContent>
        </Card>

        {/* Table */}
        <StockScreenerTable 
          stocks={stocks}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              disabled={page === pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
