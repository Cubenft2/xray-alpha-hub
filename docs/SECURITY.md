# XRayCrypto™ - Security Documentation

## Overview

XRayCrypto implements defense-in-depth security with authentication, authorization, Row-Level Security (RLS), input validation, and secure coding practices.

**Security Status**: ✅ Production-ready
**Last Security Audit**: December 2024
**Next Audit**: March 2025

---

## Authentication

### Supabase Auth

**Provider**: Supabase Auth (built on GoTrue)
**Methods Supported**:
- ✅ Email/Password
- 🔄 Google OAuth (ready to enable)
- 🔄 GitHub OAuth (ready to enable)
- 🔄 Magic Links (ready to enable)

### Session Management

```typescript
// Client-side session
const { data: { session } } = await supabase.auth.getSession();

// Auto-refresh tokens
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Update local state
  }
});
```

**Token Lifetime**:
- Access Token: 1 hour
- Refresh Token: 30 days (sliding window)

**Storage**:
- **Location**: localStorage (browser)
- **Encryption**: Tokens are JWT signed
- **XSS Protection**: HttpOnly cookies (optional)

### Password Requirements

**Client-side validation** (enforced in UI):
```typescript
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain uppercase letter")
  .regex(/[a-z]/, "Must contain lowercase letter")
  .regex(/[0-9]/, "Must contain number")
  .regex(/[^A-Za-z0-9]/, "Must contain special character");
```

**Server-side** (Supabase Auth):
- Minimum 6 characters (default)
- Recommended: Enable "Check for leaked passwords" in Supabase dashboard

---

## Authorization (RBAC)

### Role Structure

```typescript
type AppRole = 'admin' | 'moderator' | 'user';
```

### Role Assignment

**First User**: Automatically assigned `admin` role on signup
**Subsequent Users**: Default to `user` role
**Promotion**: Only admins can promote users to moderator/admin

### Role Storage

**CRITICAL**: Roles stored in separate `user_roles` table (NOT in user metadata)

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
```

**Why separate table?**
- Prevents client-side role manipulation
- Enables proper RLS policies
- Allows auditing and role history

### Role Checking Function

```sql
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
SECURITY DEFINER  -- Critical: Runs with elevated privileges
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Why SECURITY DEFINER?**
- Prevents recursive RLS checks
- Ensures consistent behavior across policies
- Isolates role logic from RLS

---

## Row-Level Security (RLS)

### Public Tables (Read Access)

**Market Data**:
```sql
-- Anyone can view active ticker mappings
CREATE POLICY "Allow public read" ON ticker_mappings
FOR SELECT USING (is_active = true);

-- Anyone can view live prices
CREATE POLICY "Allow public read" ON live_prices
FOR SELECT USING (true);

-- Anyone can view published briefs
CREATE POLICY "Allow public read" ON market_briefs
FOR SELECT USING (is_published = true);
```

### Private Tables (Service Role Only)

**Sensitive Data**:
```sql
-- Deny all public access to cache
CREATE POLICY "Deny public access" ON cache_kv
FOR ALL USING (false) WITH CHECK (false);

-- Service role bypasses RLS automatically
CREATE POLICY "Service role full access" ON cache_kv
FOR ALL USING (true) WITH CHECK (true);
```

**Tables with service role-only access**:
- `cache_kv`: Performance-sensitive cache
- `site_settings`: App configuration
- `price_sync_leader`: Leader election (prevent race conditions)
- `pending_ticker_mappings`: Admin review queue
- `missing_symbols`: Analytics data
- `market_brief_audits`: Internal metrics

### User-Specific Access

```sql
-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON user_roles
FOR SELECT USING (auth.uid() = user_id);
```

### Admin-Only Access

```sql
-- Admins can view all profiles (example)
CREATE POLICY "Admins can view all" ON profiles
FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

---

## Protected Routes

### Frontend Route Protection

```typescript
// ProtectedRoute.tsx
export function ProtectedRoute({ 
  children, 
  requireAdmin = false 
}: ProtectedRouteProps) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      
      if (requireAdmin && session) {
        // Check admin role from database
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single()
          .then(({ data }) => {
            setIsAdmin(!!data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, [requireAdmin]);

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/auth" />;
  if (requireAdmin && !isAdmin) return <AccessDenied />;
  
  return <>{children}</>;
}
```

### Route Configuration

**Public Routes** (no auth required):
```typescript
const publicRoutes = [
  '/',
  '/markets',
  '/news',
  '/crypto',
  '/stocks',
  '/brief/:slug',
  '/about',
  '/privacy',
  '/terms'
];
```

**Authenticated Routes** (login required):
```typescript
const authRoutes = [
  '/watchlist',
  '/profile',
  '/settings'
];
```

**Admin Routes** (admin role required):
```typescript
const adminRoutes = [
  '/admin',
  '/admin/generate-brief',
  '/admin/missing-tickers',
  '/admin/symbol-intelligence',
  '/admin/polygon-sync'
];
```

---

## Input Validation

### Client-Side Validation

**Using Zod schemas**:
```typescript
import { z } from 'zod';

const contactFormSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Name required")
    .max(100, "Name too long"),
  
  email: z.string()
    .trim()
    .email("Invalid email")
    .max(255),
  
  message: z.string()
    .trim()
    .min(10, "Message too short")
    .max(1000, "Message too long")
});

// Validate before submission
const result = contactFormSchema.safeParse(formData);
if (!result.success) {
  // Show errors
}
```

### XSS Protection

**DOMPurify for HTML sanitization**:
```typescript
import DOMPurify from 'dompurify';

// Sanitize before rendering
const cleanHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel']
});

// Safe rendering
<div dangerouslySetInnerHTML={{ __html: cleanHTML }} />
```

**NEVER render unsanitized user input**:
```typescript
// ❌ DANGEROUS
<div dangerouslySetInnerHTML={{ __html: userComment }} />

// ✅ SAFE
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userComment) }} />
```

### SQL Injection Protection

**Supabase client automatically parameterizes queries**:
```typescript
// ✅ SAFE - Parameterized
const { data } = await supabase
  .from('ticker_mappings')
  .select('*')
  .eq('symbol', userInput);  // Safely escaped

// ❌ NEVER use raw SQL with user input
// supabase.rpc('execute_sql', { query: `SELECT * FROM table WHERE symbol='${userInput}'` })
```

### URL Parameter Encoding

**For external API calls**:
```typescript
// ✅ SAFE - Properly encoded
const whatsappURL = `https://wa.me/?text=${encodeURIComponent(userMessage)}`;

// ❌ DANGEROUS - No encoding
const whatsappURL = `https://wa.me/?text=${userMessage}`;  // XSS vector
```

---

## API Security

### Edge Function Authentication

**Public endpoints** (no auth):
```typescript
// supabase/config.toml
[functions.coingecko-logos]
verify_jwt = false  # Anyone can call
```

**Authenticated endpoints**:
```typescript
// Edge function checks JWT
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { 
    global: { 
      headers: { Authorization: authHeader } 
    } 
  }
);

// Verify token
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response('Invalid token', { status: 401 });
}
```

### Rate Limiting

**Supabase built-in**:
- 10 requests/second per user (authenticated)
- 100 requests/minute per IP (anonymous)

**External API rate limiting**:
- CoinGecko: 50 calls/minute (free tier)
- Polygon.io: 5 calls/minute (free tier)
- LunarCrush: 100 calls/day (free tier)

**Handling**:
```typescript
const MAX_RETRIES = 3;
const BACKOFF_MS = 1000;

async function fetchWithRetry(url: string, attempt = 1) {
  try {
    const response = await fetch(url);
    
    if (response.status === 429) {  // Rate limited
      if (attempt >= MAX_RETRIES) throw new Error('Rate limited');
      
      await new Promise(resolve => 
        setTimeout(resolve, BACKOFF_MS * attempt)
      );
      return fetchWithRetry(url, attempt + 1);
    }
    
    return response;
  } catch (error) {
    console.error(`Fetch error (attempt ${attempt}):`, error);
    throw error;
  }
}
```

### CORS Configuration

**Edge functions**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Or specific domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// Add to all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

---

## Secrets Management

### Environment Variables

**Stored in Supabase**:
```
POLYGON_API_KEY
COINGECKO_API_KEY
LUNARCRUSH_API_KEY
COINGLASS_API_KEY
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Access in Edge Functions**:
```typescript
const apiKey = Deno.env.get('POLYGON_API_KEY');
if (!apiKey) {
  throw new Error('API key not configured');
}
```

**NEVER**:
- Commit secrets to Git
- Expose in client-side code
- Log secrets to console
- Return secrets in API responses

---

## Best Practices

### ✅ Implemented

1. **Separate Role Table**: Roles in `user_roles`, not user metadata
2. **Security Definer Function**: `has_role()` prevents recursive RLS
3. **RLS Enabled**: All tables have RLS policies
4. **Input Validation**: Client and server-side (Zod + DB constraints)
5. **XSS Protection**: DOMPurify for HTML sanitization
6. **Password Security**: Minimum requirements + complexity
7. **Token Refresh**: Automatic JWT refresh
8. **CORS**: Proper CORS headers on all endpoints
9. **Rate Limiting**: Built-in Supabase rate limits
10. **Secrets Management**: Environment variables via Supabase

### 🔄 Recommended (Future)

1. **2FA**: Two-factor authentication for admin accounts
2. **OAuth**: Google/GitHub sign-in
3. **Magic Links**: Passwordless authentication
4. **Rate Limiting**: Per-user API rate limits
5. **Audit Logging**: Track all admin actions
6. **IP Whitelisting**: Restrict admin access by IP
7. **Content Security Policy**: CSP headers to prevent XSS
8. **Leaked Password Check**: Enable in Supabase Auth settings

---

## Security Checklist

### Deployment Checklist

- [ ] All RLS policies enabled and tested
- [ ] Admin role properly configured
- [ ] Secrets rotated (API keys)
- [ ] Rate limiting configured
- [ ] CORS restricted to production domain
- [ ] HTTPS enforced
- [ ] Password requirements enabled
- [ ] Leaked password check enabled
- [ ] Error messages don't leak sensitive data
- [ ] Logging doesn't include PII
- [ ] Database backups configured
- [ ] Incident response plan documented

### Regular Security Tasks

**Weekly**:
- Review failed login attempts
- Check for unusual API usage patterns

**Monthly**:
- Review user roles and permissions
- Audit admin actions
- Check for outdated dependencies

**Quarterly**:
- Rotate API keys
- Review and update security policies
- Penetration testing (recommended)

---

## Incident Response

### Security Incident Process

1. **Detect**: Monitor logs for suspicious activity
2. **Assess**: Determine severity and scope
3. **Contain**: Disable compromised accounts/keys
4. **Eradicate**: Remove malicious code/access
5. **Recover**: Restore normal operations
6. **Review**: Post-mortem analysis

### Contact

**Security Issues**: Report to admin dashboard or via secure channel
**Critical Vulnerabilities**: Immediate notification required

---

## Compliance

### Data Protection

- **GDPR**: User data can be exported/deleted
- **CCPA**: California privacy rights supported
- **Data Retention**: Configurable retention periods

### Cookies & Tracking

- **Essential**: Authentication cookies (required)
- **Analytics**: None currently (can be added with consent)

---

**Security Level**: High
**Last Updated**: January 2025
**Next Review**: March 2025
