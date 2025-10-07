# XRayCrypto™ - Development Guide

## Local Setup

```bash
# Clone repository
git clone [your-repo-url]
cd xraycrypto

# Install dependencies
npm install

# Run development server
npm run dev
```

## Project Structure

```
src/
├── components/     # React components
├── pages/          # Route pages
├── hooks/          # Custom hooks
├── integrations/   # Supabase client
└── lib/           # Utilities

supabase/
└── functions/     # Edge functions
```

## Adding New Features

### New Page
1. Create `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Update navigation in `XRHeader.tsx`

### New Component
1. Create in `src/components/`
2. Use TypeScript interfaces
3. Follow existing patterns

### New Edge Function
1. Create `supabase/functions/name/index.ts`
2. Add CORS headers
3. Deploy automatically on push

## Testing

```bash
# Run type checking
npm run type-check

# Build production
npm run build
```

## Database Changes

Use Supabase migration tool (via Lovable AI)
- Never edit types.ts directly
- Always use RLS policies
- Test in development first

## Best Practices

- Use semantic color tokens
- Mobile-first responsive design
- TypeScript for type safety
- Proper error handling
- Logging for debugging
