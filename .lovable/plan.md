

# Remove Platinum & Palladium from Forex Metals Cards

## Summary
Remove Platinum (XPTUSD) and Palladium (XPDUSD) cards from the forex page since Polygon's data for these metals is incorrect (~$918 vs actual ~$2,500). Keep only Gold and Silver which have accurate data.

## File Changes

### `src/components/forex/MetalsCards.tsx`

#### 1. Update Database Query (Line 21)
Change the Supabase query to only fetch Gold and Silver:
```typescript
// Before
.in('pair', ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'])

// After
.in('pair', ['XAUUSD', 'XAGUSD'])
```

#### 2. Update Loading Skeleton Grid (Lines 32-37)
Reduce from 4 skeletons to 2 and update grid layout:
```typescript
// Before
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <Skeleton className="h-40" />
  <Skeleton className="h-40" />
  <Skeleton className="h-40" />
  <Skeleton className="h-40" />
</div>

// After
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Skeleton className="h-40" />
  <Skeleton className="h-40" />
</div>
```

#### 3. Remove Variable Assignments (Lines 43-44)
Delete the platinum and palladium variable declarations:
```typescript
// Delete these lines
const platinum = metals?.find(m => m.pair === 'XPTUSD');
const palladium = metals?.find(m => m.pair === 'XPDUSD');
```

#### 4. Clean Up slugMap (Lines 48-51)
Remove platinum and palladium entries from the slug mapping:
```typescript
// Before
const slugMap: Record<string, string> = {
  'XAUUSD': 'gold',
  'XAGUSD': 'silver',
  'XPTUSD': 'platinum',
  'XPDUSD': 'palladium'
};

// After
const slugMap: Record<string, string> = {
  'XAUUSD': 'gold',
  'XAGUSD': 'silver'
};
```

#### 5. Update Render Grid (Line 128)
Change grid from 4 columns to 2 columns on large screens:
```typescript
// Before
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// After
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

#### 6. Remove Card Renders (Lines 131-132)
Delete the Platinum and Palladium MetalCard components:
```typescript
// Delete these lines
<MetalCard metal={platinum} icon="⚪" name="Platinum" gradientClass="platinum-price-gradient" />
<MetalCard metal={palladium} icon="🔘" name="Palladium" gradientClass="palladium-price-gradient" />
```

## Result

| Aspect | Before | After |
|--------|--------|-------|
| Metals displayed | 4 (Gold, Silver, Platinum, Palladium) | 2 (Gold, Silver) |
| Grid columns (lg) | 4 | 2 |
| Database query | 4 pairs | 2 pairs |
| Loading skeletons | 4 | 2 |

## Future Consideration
When an alternative precious metals API (like Kitco, metals-api.com, or goldapi.io) is integrated, the Platinum and Palladium cards can be restored with accurate pricing data.

