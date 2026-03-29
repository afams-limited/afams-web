# AFAMS — FarmBag Store
## COPILOT_PROMPT v3 (Final Stack)
> This is the single source of truth. Replaces all previous delta files.

---

## DEFINITIVE STACK

```
GitHub: MonarCat/afams-web
│
├── HTML/CSS/JS ──────────────► Truehost (afams.co.ke + email)
│
└── supabase/
    └── functions/
        └── paystack-webhook ─► Supabase Edge Functions (Deno)
                                      │
                                      ▼
                               Supabase DB (orders, products)
                                      ▲
                               Admin dashboard (authenticated)
```

| Service  | Role                                  | Cost         |
|----------|---------------------------------------|--------------|
| Truehost | Static files + @afams.co.ke email     | KES 500/mo   |
| Supabase | Database + webhook function           | Free tier    |
| Paystack | KES payment processing                | ~1.5% per tx |
| GitHub   | Source control                        | Free         |

**No Netlify. No Vercel. No separate webhook repo.**

---

## CREDENTIALS & CONSTANTS

### Supabase
```
Project URL:  https://dvquyzzqsnlcassvgdzz.supabase.co
Project ID:   dvquyzzqsnlcassvgdzz
Anon Key:     Supabase Dashboard → Settings → API → anon/public
Service Role: Supabase Dashboard → Settings → API → service_role
              ⚠️  Never expose service_role in frontend HTML
```

### Admin Contact
```
Email:   afamskenya@gmail.com  (personal)
Domain:  afams.co.ke
```

### HTML head injection (every admin page)
```html
<script>
  window.__SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cXV5enpxc25sY2Fzc3ZnZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDMyODksImV4cCI6MjA5MDIxOTI4OX0.cUPcNPGnw3dNh19sQlUr-FFU7piRUxDSw6wh6SdfPEA';
  window.__PAYSTACK_PUBLIC_KEY = 'pk_live_f381ff48e30a32e169afcb9084e2e6664cb95876';
</script>
```

---

## REPO STRUCTURE

```
afams-web/
├── index.html                              ← Storefront
├── admin/
│   ├── login.html                          ← Admin login
│   └── dashboard.html                      ← Orders dashboard
│
├── supabase/
│   ├── 001_orders_schema.sql               ← DB schema (run once)
│   └── functions/
│       └── paystack-webhook/
│           └── index.ts                    ← Edge Function (Deno)
│
└── COPILOT_PROMPT.md                       ← This file
```

---

## EDGE FUNCTION

**Runtime:** Deno (Supabase managed — no Node, no npm, no extra repo)  
**Path:** `supabase/functions/paystack-webhook/index.ts`

**What it does:**
1. Receives POST from Paystack
2. Verifies HMAC-SHA512 signature
3. On `charge.success`: checks idempotency, writes order to Supabase

**Live URL after deploy:**
```
https://dvquyzzqsnlcassvgdzz.supabase.co/functions/v1/paystack-webhook
```

**Environment variables** (set via CLI — see Supabase setup section):
```
PAYSTACK_SECRET_KEY       → set manually via CLI
SUPABASE_URL              → auto-injected by Supabase
SUPABASE_SERVICE_ROLE_KEY → auto-injected by Supabase
```

**Deploy commands:**
```bash
npm install -g supabase                                     # one-time: install CLI
supabase login                                              # one-time: authenticate
supabase link --project-ref dvquyzzqsnlcassvgdzz           # link to your project

supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxx
supabase functions deploy paystack-webhook --no-verify-jwt
```

`--no-verify-jwt` is mandatory — Paystack has no Supabase JWT.

---

## DATABASE

Schema file: `supabase/001_orders_schema.sql` (v2 — run once in SQL Editor)

### Key tables
- `public.orders` — all order records
- `public.products` — FarmBag SKUs (seed with real prices before launch)
- `public.order_stats` — view; used by admin dashboard stats row

### Triggers (all in schema file)
- `orders_order_number` — generates AFM-YYYY-00001 via atomic sequence
- `orders_compute_total` — enforces total_amount = quantity × unit_price
- `orders_updated_at` — refreshes updated_at on every change

### RLS summary
| Table    | anon       | authenticated               | service_role |
|----------|------------|-----------------------------|--------------|
| products | SELECT ✅  | ALL ✅                      | ALL ✅       |
| orders   | none ❌    | SELECT/UPDATE/DELETE ✅     | ALL ✅       |

Orders INSERT is service_role only (webhook). No customer can write orders directly.

---

## ADMIN DASHBOARD

**Auth:** Supabase Auth (email + password). Single admin account.  
**Guard:** `sb.auth.getSession()` at top of every admin page — redirects to login if no session.

**Features:**
- Paginated orders table (25/page, unlimited total)
- Search: name, email, order number, Paystack ref
- Filter: by status, by product SKU
- Inline status dropdown per row
- Slide-over detail panel: full order info, status update, tracking number, internal notes, flag
- Stats row: total orders, revenue, pending, in progress, delivered
- CSV export (all orders)
- Auto-timestamps: paid_at, shipped_at, delivered_at on status transitions

---

## PAYSTACK CHECKOUT (storefront)

```javascript
const handler = PaystackPop.setup({
  key:      window.__PAYSTACK_PUBLIC_KEY,
  email:    customer.email,
  amount:   totalKes * 100,        // Paystack uses lowest denomination
  currency: 'KES',
  ref:      'AFM-' + Date.now(),
  metadata: {
    customer_name:    customer.name,
    customer_phone:   customer.phone,
    product_sku:      product.sku,
    product_name:     product.name,
    quantity:         quantity,
    unit_price:       product.unit_price,
    delivery_address: customer.address,
    county:           customer.county,
  },
  callback: (response) => {
    // DO NOT write to Supabase here — webhook handles it
    window.location.href = '/order-confirm.html?ref=' + response.reference;
  },
  onClose: () => { /* user closed popup */ }
});
handler.openIframe();
```

---

## TRUEHOST

**What lives here:** all HTML, CSS, JS, images  
**Web root:** `public_html/` (upload via cPanel File Manager or FTP)

**Upload structure:**
```
public_html/
├── index.html
├── admin/
│   ├── login.html
│   └── dashboard.html
└── assets/   (CSS, images, JS if any)
```

**SSL:** cPanel → SSL/TLS → Let's Encrypt → issue for afams.co.ke + www.afams.co.ke

**Email accounts to create** (cPanel → Email Accounts):
```
orders@afams.co.ke
info@afams.co.ke
ceo@afams.co.ke
complaints@afams.co.ke
partner@afams.co.ke
```

**Gmail send-as** (so you never leave Gmail):  
Settings → Accounts → Add email → SMTP: mail.afams.co.ke | Port 587 | TLS

**DNS:** Registrar nameservers must point to Truehost only:
```
ns1.truehost.co.ke
ns2.truehost.co.ke
```

---

## PRODUCT SKUs

| SKU       | Name             | Price (KES) |
|-----------|------------------|-------------|
| FB-CLS-01 | FarmBag Classic  | 7500        |
| FB-VRT-01 | FarmBag Vertical | 8500        |

Update via: Supabase Dashboard → Table Editor → products → edit unit_price

No stock limits. No countdown timers. Pure preorder model.

---

## SUPABASE KEEP-ALIVE

Free tier pauses after 7 days of inactivity. During launch (active traffic) this won't trigger.  
Set a free cron at cron-job.org as insurance:
```
URL:     https://dvquyzzqsnlcassvgdzz.supabase.co/rest/v1/products?select=sku&limit=1
Header:  apikey: YOUR_ANON_KEY
Every:   3 days
```

---

## MASTER CHECKLIST

### Supabase
```
□ Run 001_orders_schema.sql in SQL Editor
□ Create admin user: Authentication → Users → Add User (afamskenya@gmail.com)
□ Update product prices: Table Editor → products
□ Confirm order_stats view returns data
□ Install Supabase CLI and link project
□ Set PAYSTACK_SECRET_KEY via CLI
□ Deploy edge function with --no-verify-jwt
```

### Paystack
```
□ Set webhook URL: Settings → API → Webhook URL
  https://dvquyzzqsnlcassvgdzz.supabase.co/functions/v1/paystack-webhook
□ Send test event and confirm order appears in Supabase
□ Set public key in HTML head injection
□ Confirm KES is the default currency
```

### Truehost
```
□ Point registrar nameservers to ns1/ns2.truehost.co.ke
□ Upload files to public_html/ (index.html at root)
□ Issue Let's Encrypt SSL
□ Create email accounts
□ Connect Gmail send-as (SMTP port 587)
```

### GitHub
```
□ Repo: MonarCat/afams-web
□ supabase/ folder committed with edge function
□ Admin HTML files committed
```

---

## DEBUGGING

| Issue | Check |
|-------|-------|
| Webhook 401 | `PAYSTACK_SECRET_KEY` not set — run: `supabase secrets set ...` |
| Webhook not firing | Paystack webhook URL not updated to Supabase edge function URL |
| Orders not appearing | Check Supabase → Edge Functions → Logs |
| Admin login fails | User not created in Supabase → Authentication → Users |
| Site 404 | `index.html` not at `public_html/` root on Truehost |
| SSL error | Re-issue Let's Encrypt after DNS fully propagates |
| Supabase paused | Visit dashboard — it prompts to restore with one click |
| Email not sending | Try port 587 instead of 465; check SPF record in Truehost DNS |

---

## LATER

- [ ] Supabase Realtime — live order updates in admin dashboard
- [ ] Audit log table — track who changed what
- [ ] Multi-admin support via Supabase Auth roles
- [ ] Analytics via Plausible (privacy-first, no cookies)
