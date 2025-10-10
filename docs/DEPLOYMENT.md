# XRayCrypto™ - Deployment Guide

## Quick Deploy via Lovable

1. Click **Publish** button in top right
2. Choose deployment environment
3. Automatic deployment (2-3 minutes)
4. Edge functions deploy automatically

## Custom Domain

1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS:
   - Type: CNAME
   - Name: www (or @)
   - Value: [provided by Lovable]
4. Wait for SSL certificate (automatic)

## Environment Variables

All secrets managed in Supabase dashboard:
- POLYGON_API_KEY
- COINGECKO_API_KEY
- LUNARCRUSH_API_KEY
- OPENAI_API_KEY
- Other API keys

**Note**: Ticker mappings and chart overrides are stored in code:
- `src/config/tickerMappings.ts` - Global symbol mappings
- `src/pages/MarketBriefHome.tsx` - Runtime overrides (lines 155-176)
- No environment variables needed for these configurations

## Production Checklist

- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] All API keys set
- [ ] RLS policies enabled
- [ ] Admin user created
- [ ] Test all major features
- [ ] Enable Supabase Auth email verification

## Monitoring

- Supabase Dashboard: Database metrics
- Edge Function Logs: Monitor API calls
- Analytics: Track usage patterns
