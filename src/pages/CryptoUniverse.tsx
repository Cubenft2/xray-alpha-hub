import { CryptoUniverseTable } from '@/components/CryptoUniverseTable';
import { CryptoUniverseInsights } from '@/components/CryptoUniverseInsights';
import { CryptoUniverseFilters } from '@/components/CryptoUniverseFilters';
import { CryptoUniverseLoader } from '@/components/CryptoUniverseLoader';
import { useLunarCrushUniverse } from '@/hooks/useLunarCrushUniverse';
import { SEOHead } from '@/components/SEOHead';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CryptoUniverse() {
  const {
    coins,
    metadata,
    loading,
    isFetching,
    error,
    filters,
    setFilters,
    sortKey,
    sortDirection,
    handleSort,
    refetch,
    currentPage,
    totalPages,
    handlePageChange,
    startIndex,
    endIndex,
    totalFilteredItems,
  } = useLunarCrushUniverse();

  if (loading) {
    return (
      <>
        <SEOHead
          title="Crypto Universe | XRayCrypto™"
          description="Explore the top 3000 cryptocurrencies with LunarCrush social intelligence data including Galaxy Scores, AltRank, sentiment analysis, and real-time market data."
        />
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              🌙 Crypto Universe
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Powered by LunarCrush • Top 3000 by Market Cap • Updates Every 5 Minutes
            </p>
          </div>
          <CryptoUniverseLoader />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEOHead
          title="Crypto Universe | XRayCrypto™"
          description="Explore the top 3000 cryptocurrencies with LunarCrush social intelligence data."
        />
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              🌙 Crypto Universe
            </h1>
          </div>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg text-muted-foreground">Failed to load data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Crypto Universe | XRayCrypto™"
        description="Explore the top 3000 cryptocurrencies with LunarCrush social intelligence data including Galaxy Scores, AltRank, sentiment analysis, and real-time market data."
      />
      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            🌙 Crypto Universe
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Powered by LunarCrush • Top 3000 by Market Cap • Updates Every 5 Minutes
            {metadata?.last_updated && (
              <span className="ml-2 text-xs opacity-70">
                (Last: {new Date(metadata.last_updated).toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>

        {/* Insights */}
        <CryptoUniverseInsights metadata={metadata} isLoading={isFetching} />

        {/* Filters */}
        <CryptoUniverseFilters
          filters={filters}
          setFilters={setFilters}
          onRefresh={() => refetch()}
          isLoading={isFetching}
          totalCount={totalFilteredItems}
          lastUpdated={metadata?.last_updated}
        />

        {/* Table */}
        <CryptoUniverseTable
          coins={coins}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalFilteredItems}
          isLoading={isFetching && coins.length === 0}
        />
      </div>
    </>
  );
}
