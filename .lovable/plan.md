
# Expand Metals Tab to Show All 31 Gold & Silver Pairs

## Overview
Update the Forex Screener to display all 31 gold and silver pairs in the Metals tab (currently only shows XAUUSD and XAGUSD), and add a Quote Currency column for quick visual reference.

## Changes Required

### File: `src/components/ForexScreener.tsx`

#### 1. Update Metals Query (lines 36-50)
Change the query to fetch all pairs where `base_currency` is XAU or XAG instead of matching specific pair names:

```typescript
const { data: metalsPairs, isLoading: metalsLoading } = useQuery({
  queryKey: ['forex-screener-metals'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('forex_cards')
      .select('*')
      .eq('is_active', true)
      .in('base_currency', ['XAU', 'XAG'])
      .order('base_currency', { ascending: true })
      .order('quote_currency', { ascending: true });
    
    if (error) throw error;
    console.log('[ForexScreener] Metals query returned:', data?.length, 'pairs');
    return data || [];
  },
  refetchInterval: 30000,
});
```

#### 2. Add Quote Currency Column to Table Header (line 184)
Insert a new column after "Pair" to show the quote currency:

```tsx
<TableHead><SortButton field="pair">Pair</SortButton></TableHead>
<TableHead className="hidden sm:table-cell">Quote</TableHead>  {/* NEW */}
```

#### 3. Add Quote Currency Column to Table Body (after line 209)
Display the quote currency with a flag emoji where possible:

```tsx
<TableCell className="hidden sm:table-cell">
  <div className="flex items-center gap-1">
    {pair.quote_flag && <span>{pair.quote_flag}</span>}
    <span className="text-muted-foreground text-sm">{pair.quote_currency}</span>
  </div>
</TableCell>
```

## Expected Result

| Tab | Before | After |
|-----|--------|-------|
| Metals | 2 pairs (XAUUSD, XAGUSD) | 31 pairs (all XAU + XAG combinations) |
| Quote Column | Not shown | Shows quote currency (USD, EUR, GBP, etc.) with flag |

### Sample Metals Tab View After Change:

| Pair | Quote | Rate | 24h |
|------|-------|------|-----|
| XAUUSD | 🇺🇸 USD | 5,314.20 | -3.58% |
| XAUEUR | 🇪🇺 EUR | 4,448.20 | -3.33% |
| XAUGBP | 🇬🇧 GBP | 3,857.70 | -3.15% |
| XAGJPY | 🇯🇵 JPY | 17,457.67 | -3.03% |
| ... | ... | ... | ... |

## Technical Notes
- Uses existing `base_currency` and `quote_currency` columns from `forex_cards` table
- Quote flag emoji comes from existing `quote_flag` column (may be null for some currencies)
- Maintains responsive design by hiding Quote column on mobile (`hidden sm:table-cell`)
- No pagination needed for metals (only 31 rows)
