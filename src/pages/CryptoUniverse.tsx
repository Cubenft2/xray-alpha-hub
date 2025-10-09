import { Skeleton } from '@/components/ui/skeleton';
import { CryptoUniverseTable } from '@/components/CryptoUniverseTable';
import { CryptoUniverseInsights } from '@/components/CryptoUniverseInsights';
import { CryptoUniverseFilters } from '@/components/CryptoUniverseFilters';
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

  return (
    <div className="container mx-auto px-4 py-6 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          🌙 Crypto Universe
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Powered by LunarCrush • Updated Hourly
        </p>
      </div>

      {/* Filters */}
      {loading ? (
        <Skeleton className="h-14 w-full" />
      ) : (
        <CryptoUniverseFilters filters={filters} setFilters={setFilters} />
      )}

      {/* Insights */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <CryptoUniverseInsights coins={allCoins} metadata={metadata} />
      )}

      {/* Table */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
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
      )}
    </div>
  );
}
