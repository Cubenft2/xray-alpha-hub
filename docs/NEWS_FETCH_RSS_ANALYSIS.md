# news-fetch-rss Analysis

**Date:** 2026-01-05  
**Question:** Can we safely remove `news-fetch-rss` cron job?

---

## 1. What does `news-fetch-rss` do?

The cron job `news-fetch-rss` calls the `news-fetch` function (located at `supabase/functions/news-fetch/index.ts`).

### Function Behavior:
- **Fetches from multiple RSS feeds:**
  - **Crypto feeds (7):** CoinDesk, CoinTelegraph, Decrypt, CryptoNews, Bitcoin Magazine, CryptoPotato, CryptoSlate
  - **Stock feeds (8):** Reuters, CNBC, Dow Jones, Bloomberg, Yahoo Finance, Financial Times, ZeroHedge, Investing.com
  - **Trump feeds (6):** Truth Social, Breitbart, Fox News, Daily Wire, Newsmax, OANN
- **Also fetches from Polygon API** (limit 50 articles)
- **Writes to:** `cache_kv` table with key `news_fetch:v1:limit=100`
- **Cache TTL:** 5 minutes
- **Requires:** `CRON_SECRET` to refresh (non-cron requests return cache only)

---

## 2. What does `polygon-news-unified` do differently?

### Function Behavior:
- **Fetches ONLY from Polygon API** (limit 1000 articles)
- **Stocks ONLY** - Polygon doesn't provide crypto news
- **Writes to TWO places:**
  1. `cache_kv` table with key `polygon_news_unified_cache`
  2. `stock_cards` table (updates `top_news` column per symbol)
- **Cache TTL:** 20 minutes
- **Requires:** `CRON_SECRET` to refresh

### Key Differences:

| Feature | news-fetch | polygon-news-unified |
|---------|-----------|---------------------|
| **RSS Feeds** | ✅ Yes (22+ feeds) | ❌ No |
| **Polygon API** | ✅ Yes (limit 50) | ✅ Yes (limit 1000) |
| **Crypto News** | ✅ Yes (from RSS) | ❌ No (Polygon = stocks only) |
| **Stock News** | ✅ Yes (RSS + Polygon) | ✅ Yes (Polygon only) |
| **Trump News** | ✅ Yes (RSS feeds) | ✅ Yes (keyword detection) |
| **Updates stock_cards** | ❌ No | ✅ Yes |
| **Cache Key** | `news_fetch:v1:limit=100` | `polygon_news_unified_cache` |

---

## 3. Frontend Usage

### `get-cached-news` Function (Read-Only)
The frontend calls `get-cached-news`, which:
- **Reads from THREE cache keys:**
  1. `polygon_news_unified_cache` (from polygon-news-unified)
  2. `lunarcrush_news_cache` (from lunarcrush-news)
  3. `news_fetch:v1:limit=100` (from news-fetch) ⚠️ **THIS ONE**
- **Merges all sources** with deduplication
- **Priority:** LunarCrush > Polygon > RSS

### Frontend Component (`NewsSection.tsx`)
- Calls `get-cached-news` function
- Displays merged news in three tabs: Crypto, Markets, Trump
- **Line 62 comment:** "News is populated by crons: news-fetch (Polygon/RSS) and lunarcrush-news"

---

## 4. Impact of Removing `news-fetch-rss`

### ✅ What Will Still Work:
- **Stock news** - `polygon-news-unified` provides this (better quality, more articles)
- **Crypto news** - `lunarcrush-news` provides this (social engagement data)
- **Trump news** - `polygon-news-unified` detects Trump keywords

### ❌ What Will Break:
- **RSS feed news** - The 22+ RSS feeds will stop updating
- **RSS crypto news** - CoinDesk, CoinTelegraph, Decrypt, etc. will become stale
- **RSS stock news** - Reuters, CNBC, Bloomberg RSS feeds will stop updating
- **RSS Trump news** - Truth Social, Breitbart, Fox News RSS feeds will stop updating

### ⚠️ Impact Assessment:

**Low Impact:**
- Stock news: `polygon-news-unified` provides better quality (1000 articles vs 50)
- Crypto news: `lunarcrush-news` provides social engagement data (better for crypto)

**Medium Impact:**
- RSS feeds provide **diversity** - different sources, different perspectives
- RSS feeds may catch news **faster** than Polygon API
- Some RSS sources (ZeroHedge, Truth Social) are unique

**High Impact:**
- If `news-fetch-rss` is the **only** source for certain RSS feeds, removing it means those feeds stop updating
- The `news_fetch:v1:limit=100` cache will become stale after 5 minutes

---

## 5. Recommendation

### Option A: Keep `news-fetch-rss` (Recommended)
**Pros:**
- Maintains RSS feed diversity
- Provides backup if Polygon API fails
- Unique sources (Truth Social, ZeroHedge, etc.)
- Low cost (RSS feeds are free)

**Cons:**
- Duplicate Polygon API calls (50 vs 1000 in polygon-news-unified)
- Extra cron job to maintain

**Action:** Add to `config.toml` for documentation

### Option B: Remove `news-fetch-rss` (Risky)
**Pros:**
- One less cron job
- No duplicate Polygon API calls
- Simpler architecture

**Cons:**
- **Loses 22+ RSS feed sources**
- RSS news becomes stale
- Less news diversity
- May break frontend if it expects RSS news

**Action:** 
1. Monitor `get-cached-news` to see if RSS cache is actually used
2. Check frontend metrics for news quality/completeness
3. Remove only if RSS cache is consistently empty/stale

---

## 6. Verification Queries

Run these to check if RSS cache is actively used:

```sql
-- Check if news-fetch cache exists and is fresh
SELECT 
  k,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN 'FRESH'
    ELSE 'STALE'
  END as status,
  jsonb_array_length((v->>'crypto')::jsonb) as crypto_count,
  jsonb_array_length((v->>'stocks')::jsonb) as stocks_count,
  jsonb_array_length((v->>'trump')::jsonb) as trump_count
FROM cache_kv
WHERE k = 'news_fetch:v1:limit=100';

-- Check last update time
SELECT 
  k,
  created_at,
  expires_at,
  NOW() - created_at as age
FROM cache_kv
WHERE k = 'news_fetch:v1:limit=100';
```

---

## 7. Final Verdict

**⚠️ DO NOT REMOVE YET**

**Reasoning:**
1. `get-cached-news` actively reads from `news_fetch:v1:limit=100` cache
2. RSS feeds provide unique sources not available from Polygon
3. Low cost to maintain (RSS feeds are free)
4. Provides redundancy if Polygon API fails

**Recommended Action:**
1. **Add to config.toml** - Document the cron job properly
2. **Monitor usage** - Check if RSS cache is actually being used by frontend
3. **Consider deprecation later** - Only remove if metrics show it's not needed

**Alternative:** If you want to remove it, first verify:
- Frontend doesn't break
- News quality doesn't degrade
- Users don't complain about missing sources
