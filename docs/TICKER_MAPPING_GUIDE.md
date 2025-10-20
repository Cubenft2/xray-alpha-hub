# Ticker Mapping Guide

This guide explains how XRayCrypto maintains accurate symbol mappings for TradingView charts and price data.

## Overview

The `ticker_mappings` table is the single source of truth for how cryptocurrency symbols map to:
- **TradingView symbols** (for charts)
- **CoinGecko IDs** (for price data)
- **Polygon tickers** (for additional data)
- **Display names** (for UI)

## Exchange Priority Rules

When mapping symbols to TradingView, follow these priority rules:

### 1. **Prefer USD over USDT**
Most major exchanges support both USD and USDT pairs, but USD is preferred for:
- Better liquidity
- More accurate pricing
- Direct fiat representation
- Lower spreads

**Example:**
- ✅ `COINBASE:CROUSD` (Correct)
- ❌ `COINBASE:CROUSDT` (Avoid)

### 2. **Exchange Priority**
Choose exchanges in this order:
1. **Coinbase** - Preferred for USD pairs, high liquidity
2. **Kraken** - Good for USD pairs, reliable
3. **Binance** - Largest volume, but often USDT-focused
4. **OKX** - Good for assets with both USD and USDT
5. **Others** (MEXC, Bybit, etc.) - Use when asset isn't on major exchanges

### 3. **When to Use USDT**
Only use USDT pairs when:
- The asset is ONLY available with USDT on that exchange
- The exchange (like OKX) has better USDT liquidity
- Major exchanges don't list the asset (use smaller exchanges)

**Examples:**
- ✅ `OKX:LEOUSDT` - LEO has better volume on OKX with USDT
- ✅ `MEXC:MEMECOREUSDT` - MemeCore only listed on smaller exchanges

## Database Validation

The database includes an automatic validation trigger that warns when:
- You use USDT on Coinbase, Kraken, or Gemini (which support USD)

Example warning:
```
WARNING: Symbol CRO uses USDT on an exchange that typically supports USD pairs. 
Consider using USD instead: COINBASE:CROUSDT
```

## How to Add/Update Mappings

### 1. **Check TradingView First**
Before adding a mapping, verify the symbol exists on TradingView:
```
https://www.tradingview.com/symbols/EXCHANGE:SYMBOL/
```

Examples:
- https://www.tradingview.com/symbols/COINBASE-CROUSD/
- https://www.tradingview.com/symbols/OKX-LEOUSDT/

### 2. **Update via SQL**
```sql
UPDATE ticker_mappings
SET tradingview_symbol = 'COINBASE:CROUSD',
    display_name = 'Cronos (CRO)',
    updated_at = now()
WHERE symbol = 'CRO';
```

### 3. **Add New Mapping**
```sql
INSERT INTO ticker_mappings (
    symbol,
    display_name,
    type,
    tradingview_symbol,
    coingecko_id,
    is_active
) VALUES (
    'NEWTOKEN',
    'New Token (NEWTOKEN)',
    'crypto',
    'BINANCE:NEWTOKENUSDT',
    'newtoken-coingecko-id',
    true
);
```

## Verification After Changes

### 1. **Check Brief Generation Logs**
The brief generation function logs all symbol mappings:
```
📊 Symbol Mappings for Brief:
  ✅ CRO: COINBASE:CROUSD
  ✅ LINK: COINBASE:LINKUSD
  ⚠️ NEWTOKEN: NO MAPPING FOUND - using fallback
```

### 2. **Test TradingView Links**
Verify the charts work in the generated briefs by clicking the TradingView links.

### 3. **Monitor Missing Symbols**
Check the `missing_symbols` table for any symbols that appeared in briefs but lack mappings:
```sql
SELECT * FROM missing_symbols 
WHERE resolved = false 
ORDER BY occurrence_count DESC;
```

## Common Issues

### Issue: Symbol shows wrong price
**Cause:** Incorrect TradingView symbol (e.g., using USDT instead of USD)  
**Fix:** Update the `tradingview_symbol` in `ticker_mappings`

### Issue: "NO MAPPING FOUND" in logs
**Cause:** Symbol exists in CoinGecko but not in `ticker_mappings`  
**Fix:** Add a new mapping following the steps above

### Issue: Chart doesn't load on TradingView
**Cause:** Symbol format is incorrect or exchange doesn't support that pair  
**Fix:** Verify the symbol on TradingView first, then correct the mapping

## Related Files

- **Database Table:** `ticker_mappings`
- **Edge Function:** `supabase/functions/generate-brief-claude/`
- **Symbol Resolver:** `symbol-resolver.ts`
- **Prompt Builder:** `prompt-builder.ts`
- **Validation Trigger:** `validate_tradingview_symbol()`

## Questions?

If you're unsure about a mapping:
1. Check TradingView for the correct format
2. Look at existing mappings for similar assets
3. Test with the priority rules (USD > USDT, Coinbase > others)
4. Monitor the edge function logs after adding

---

**Last Updated:** 2025-10-20
