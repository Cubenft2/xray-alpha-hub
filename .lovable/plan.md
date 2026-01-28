
# Fix Platinum & Palladium Prices Only

## Problem
Only **Platinum (XPTUSD)** and **Palladium (XPDUSD)** are showing incorrect prices:

| Metal | Shows | Actual | Status |
|-------|-------|--------|--------|
| Gold | $5,167 | ~$5,080 | ✅ Working |
| Silver | $112 | ~$100 | ✅ Working |
| Platinum | **$917** | **~$2,340** | ❌ Wrong |
| Palladium | **$965** | **~$1,900** | ❌ Wrong |

## Solution
Keep Gold and Silver fetching as-is. Only switch Platinum and Palladium to use the real-time Last Quote endpoint.

## File to Modify
`supabase/functions/sync-forex-cards-polygon/index.ts`

## Changes

**Replace lines 106-139** with logic that:
1. Uses the existing `/prev` endpoint for Gold (XAUUSD) and Silver (XAGUSD) - **unchanged**
2. Uses the `/v1/last_quote/currencies/{from}/{to}` endpoint for Platinum and Palladium only

```typescript
// Precious metals - Gold/Silver use prev endpoint, Platinum/Palladium use last quote
const METAL_PAIRS_PREV = ['XAUUSD', 'XAGUSD'];  // Working fine with /prev
const METAL_PAIRS_QUOTE = ['XPTUSD', 'XPDUSD']; // Need real-time quote

// Gold and Silver - existing working logic
for (const metalPair of METAL_PAIRS_PREV) {
  // Keep existing /prev endpoint logic (unchanged)
}

// Platinum and Palladium - use last quote for accurate prices
for (const metalPair of METAL_PAIRS_QUOTE) {
  const from = metalPair.slice(0, 3);  // XPT or XPD
  const to = metalPair.slice(3);        // USD
  
  const quoteUrl = `https://api.polygon.io/v1/last_quote/currencies/${from}/${to}?apiKey=${polygonKey}`;
  // Calculate mid price from bid/ask
  // Use that as the rate
}
```

## Expected Results

| Metal | Before | After |
|-------|--------|-------|
| Gold | $5,167 ✅ | $5,167 ✅ (unchanged) |
| Silver | $112 ✅ | $112 ✅ (unchanged) |
| Platinum | $917 ❌ | ~$2,340 ✅ |
| Palladium | $965 ❌ | ~$1,900 ✅ |

## Testing
1. Deploy updated edge function
2. Invoke `sync-forex-cards-polygon` 
3. Verify only Platinum/Palladium prices change
4. Confirm Gold/Silver remain accurate
