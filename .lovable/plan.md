

# Fix Forex Screener Query Issues

## Problem Identified

The Forex Screener has two issues:

| Issue | Cause | Impact |
|-------|-------|--------|
| **Missing pairs in "All" tab** | Supabase default limit of 1000 rows | 222 pairs are not displayed (1222 total, only 1000 shown) |
| **Metals tab shows too many pairs** | Query uses `base_currency IN (...)` returning 33 pairs | Displays all XAU/XAG cross-pairs instead of just USD pairs |

**Note:** The database data is fresh (last updated 4 minutes ago at 18:35:02 UTC). This is NOT a stale data issue.

## Solution

### 1. Fix the "All" Tab Row Limit

Add explicit limit to fetch all 1222+ pairs:

```typescript
// In the allPairs query (line 53-66)
const { data, error } = await supabase
  .from('forex_cards')
  .select('*')
  .eq('is_active', true)
  .order('pair', { ascending: true })
  .limit(2000);  // Add explicit limit to get all pairs
```

### 2. Fix the Metals Tab Query

Update the metals query to match the cleaned-up MetalsCards (only XAUUSD and XAGUSD):

```typescript
// In the metalsPairs query (line 36-50)
const { data, error } = await supabase
  .from('forex_cards')
  .select('*')
  .eq('is_active', true)
  .in('pair', ['XAUUSD', 'XAGUSD']);  // Changed from base_currency filter
```

This makes the ForexScreener consistent with the MetalsCards component.

## File Changes

### `src/components/ForexScreener.tsx`

#### Change 1: Update Metals Query (Lines 39-43)
```typescript
// Before
.in('base_currency', ['XAU', 'XAG', 'XPT', 'XPD']);

// After
.in('pair', ['XAUUSD', 'XAGUSD']);
```

#### Change 2: Add Limit to All Pairs Query (Lines 56-60)
```typescript
// Before
.order('pair', { ascending: true });

// After
.order('pair', { ascending: true })
.limit(2000);
```

#### Change 3: Clean up OANDA_PAIRS Constant (Lines 27)
Remove XPTUSD and XPDUSD since we removed those metals:
```typescript
// Before
'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'

// After
'XAUUSD', 'XAGUSD'
```

## Expected Results

| Tab | Before | After |
|-----|--------|-------|
| Metals | 33 pairs (all XAU/XAG crosses) | 2 pairs (XAUUSD, XAGUSD) |
| Major | Working correctly | No change |
| All | ~1000 pairs (limited) | All 1222+ pairs |

## Technical Details

- The `forex_cards` table has 1,222 active pairs
- Supabase's default row limit is 1000
- Using `.limit(2000)` ensures we fetch all pairs with room for growth
- Changing from `base_currency` to `pair` filter aligns with MetalsCards cleanup

