import { CryptoUniverseTable } from '@/components/CryptoUniverseTable';
import { CryptoUniverseInsights } from '@/components/CryptoUniverseInsights';
import { CryptoUniverseFilters } from '@/components/CryptoUniverseFilters';
import { CryptoUniverseLoader } from '@/components/CryptoUniverseLoader';
import { useLunarCrushUniverse } from '@/hooks/useLunarCrushUniverse';

export default function CryptoUniverse() {
  const {
    coins,
    allCoins,
    metadata,
    loading,
    filters,
    setFilters,
    sortKey,
    sortDirection,
    handleSort,
    currentPage,
    totalPages,
    handlePageChange,
    startIndex,
    endIndex,
    totalFilteredItems,
  } = useLunarCrushUniverse();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            🌙 Crypto Universe
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Powered by LunarCrush • Top 3000 by Market Cap • Updates Every 5 Minutes
          </p>
        </div>
        <CryptoUniverseLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-3">
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

      {/* Filters */}
      <CryptoUniverseFilters filters={filters} setFilters={setFilters} />

      {/* Insights */}
      <CryptoUniverseInsights coins={allCoins} metadata={metadata} />

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
      />
    </div>
  );
}
