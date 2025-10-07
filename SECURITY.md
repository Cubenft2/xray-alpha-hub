# Security Documentation

This document outlines the security measures implemented in XRayCrypto™.

## Authentication & Authorization

### User Authentication
- **Provider**: Supabase Auth
- **Method**: Email + Password
- **Session Management**: 
  - Sessions persist in localStorage
  - Auto-refresh tokens enabled
  - Default session duration: ~7 days

### Role-Based Access Control (RBAC)

#### User Roles
Roles are stored in the `user_roles` table with the following enum:
```sql
type app_role as enum ('admin', 'moderator', 'user')
```

#### First User Auto-Admin
- **Feature**: The first user to sign up is automatically assigned the `admin` role
- **Implementation**: During signup, the system checks if `user_roles` table is empty (count = 0)
- **Purpose**: Ensures the site owner gets admin access without manual database intervention
- **Security**: Only works for the very first user; subsequent signups require manual role assignment

#### Admin Access Control
- **Protected Routes**: Admin pages use `<ProtectedRoute requireAdmin={true}>`
- **Component**: `src/components/ProtectedRoute.tsx`
- **Behavior**: 
  - Redirects to `/auth` if not authenticated
  - Shows "Access Denied" if authenticated but not admin
  - Renders protected content only for admin users

### Security Definer Function
The `has_role()` function prevents recursive RLS policy checks:

```sql
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
```

This function:
- Executes with owner privileges (bypassing RLS)
- Prevents infinite recursion in role checks
- Used in RLS policies to verify user permissions

## Row-Level Security (RLS)

### Public Tables
The following tables allow public read access:
- `cg_master` - CoinGecko master data
- `earnings_calendar` - Earnings events
- `exchange_pairs` - Trading pairs
- `live_prices` - Real-time price data
- `poly_fx_pairs` - Polygon forex pairs
- `poly_tickers` - Polygon ticker data
- `social_sentiment` - Social sentiment data
- `ticker_mappings` - Symbol mappings (active only)
- `quote_library` - Daily quotes (active only)
- `market_briefs` - Market briefs (published only)
- `market_alerts` - Active alerts only

### Service Role Only Tables
These tables deny all public/authenticated access, only accessible via service role:
- `cache_kv` - Key-value cache
- `missing_symbols` - Symbol resolution tracking
- `pending_ticker_mappings` - Pending symbol validations
- `price_sync_leader` - Price sync coordination
- `site_settings` - Application settings
- `market_brief_audits` - Brief generation audit logs

### User-Specific Tables
- `user_roles` - Users can view their own roles only

## Protected Routes

### Public Routes
- `/` - Home
- `/crypto` - Crypto markets
- `/markets` - Stock markets
- `/news` - News feed
- `/watchlist` - Watchlist (may add auth later)
- `/chill` - Chill zone
- `/store` - Store
- `/about` - About page
- `/support` - Support page
- `/auth` - Login/Signup

### Admin-Only Routes
- `/admin` - Admin dashboard
- `/admin/generate-brief` - Brief generation
- `/admin/missing-tickers` - Ticker management
- `/admin/symbol-intelligence` - Symbol validation

## Email Verification

**Current Status**: Optional

To speed up testing, you can disable "Confirm email" in Supabase dashboard:
1. Go to Authentication > Providers
2. Toggle off "Confirm email"

**Production Recommendation**: Enable email confirmation for production deployments.

## Input Validation & XSS Protection

### Client-Side Validation
- **Email Validation**: Uses Zod schema to validate email format and length (max 255 chars)
- **Password Requirements**: 
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- **Real-time Error Messages**: Displays validation errors immediately on form fields

### HTML Sanitization
- **DOMPurify Integration**: All HTML content is sanitized before rendering
- **Allowed Tags**: Only safe HTML tags permitted (p, br, strong, h1-h6, span, etc.)
- **Allowed Attributes**: Limited to safe attributes (class, data-ticker, data-type, style)
- **XSS Prevention**: Blocks malicious scripts and unsafe HTML from user-generated content

## Password Security

### Current Settings
- **Minimum Length**: 8 characters (enforced client-side with Zod)
- **Complexity Requirements**: Mixed case + numbers required
- **Leaked Password Protection**: ⚠️ Should be enabled in Supabase

### Recommended Settings (Supabase Dashboard)
1. Navigate to: **Authentication** → **Providers** → **Email**
2. Enable **"Check for leaked passwords"**
3. This checks passwords against known breach databases (Have I Been Pwned)

## Best Practices Implemented

✅ **Roles in separate table** - Prevents privilege escalation attacks  
✅ **No client-side role storage** - All role checks via database  
✅ **Security definer function** - Prevents RLS recursion  
✅ **Protected route component** - Consistent auth checking  
✅ **Service role isolation** - Sensitive tables blocked from public access  
✅ **Auto-refresh tokens** - Seamless session management  
✅ **First-user admin** - Simplified initial setup  
✅ **Input validation with Zod** - Strong email/password validation  
✅ **HTML sanitization with DOMPurify** - XSS attack prevention  
✅ **Real-time validation feedback** - User-friendly error messages

## Potential Improvements

- [ ] Add two-factor authentication (2FA)
- [ ] Implement OAuth providers (Google, GitHub, etc.)
- [ ] Add rate limiting on auth endpoints and admin functions
- [ ] Implement password reset flow
- [ ] Add audit logging for admin actions
- [ ] Consider adding `moderator` and `user` roles with specific permissions
- [ ] Enable "Check for leaked passwords" in Supabase Auth settings

## Admin Access Flow

```
User Signup → Check if first user → Yes → Insert admin role → Done
                                  → No → Regular user → Manual role assignment needed
```

## Testing Admin Access

1. Sign up with first account → Auto-admin assigned
2. Log in → See "Admin" button in header
3. Click "Admin" → Access admin dashboard
4. All admin features available

## Security Testing

### Validation Testing
1. Try signing up with weak passwords → Should show validation errors
2. Try invalid email formats → Should show email validation errors
3. Check that validation errors clear when correcting input

### XSS Testing
1. Market briefs with HTML content → Should display safely without executing scripts
2. All ticker data and prices → Should be properly escaped

---

**Last Updated**: 2025-10-07  
**Version**: 1.1  
**Security Grade**: A- (Excellent with recommended improvements)
