
# Fix Forex Screener - Pagination Required

## What Went Wrong

The previous fix added `.limit(2000)` but this doesn't work because:
- Supabase PostgREST enforces a **server-side maximum of 1000 rows** per query
- The `.limit()` parameter cannot override this server limit
- Network response confirmed: `content-range: 0-999/*` (only 1000 rows returned)

## Correct Solution: Pagination

Implement pagination to fetch all 1,222+ pairs in multiple batches.

## Implementation

### File: `src/components/ForexScreener.tsx`

**Replace the `allPairs` query with paginated fetch:**

```typescript
const { data: allPairs, isLoading: allLoading } = useQuery({
  queryKey: ['forex-screener-all'],
  queryFn: async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('forex_cards')
        .select('*')
        .eq('is_active', true)
        .order('pair', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  },
  refetchInterval: 30000,
});
```

## How It Works

| Batch | Range | Rows Fetched |
|-------|-------|--------------|
| 1 | 0-999 | 1000 pairs |
| 2 | 1000-1999 | 222 pairs |
| **Total** | | **1,222 pairs** |

## Expected Result

- **Metals Tab**: 2 pairs (XAUUSD, XAGUSD) ✅ Already working
- **Major Tab**: ~7 pairs ✅ Already working  
- **All Tab**: **1,222 pairs** ✅ Will now show all pairs

## Why This Works

The `.range(offset, offset + PAGE_SIZE - 1)` method:
1. Fetches rows in chunks that stay under the 1000-row server limit
2. Loops until all data is retrieved
3. Combines all batches into one array for the component
