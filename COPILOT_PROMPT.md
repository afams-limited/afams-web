# AFAMS — Copilot Prompt & Stack Reference

## STACK (UPDATED)

```
GitHub (MonarCat/afams-web)
    ├── HTML files → Truehost cPanel (afams.co.ke)
    └── api/ folder → Vercel (webhook only)

Payment flow:
  Paystack → POST https://afams-webhook.vercel.app/api/paystack-webhook
           → Supabase orders table
```

**Truehost** — static files + `@afams.co.ke` email  
**Vercel** — one serverless function (same account as D.A + salary calculator)  
**Supabase** — unchanged  
**Netlify** — removed entirely

---

## VERCEL PROJECT (webhook-only)

Create a **separate** Vercel project for Afams (not inside D.A or salary calc repos).

### Repo structure for Vercel deployment
```
afams-webhook/          ← standalone repo or subfolder
├── api/
│   └── paystack-webhook.js
└── vercel.json
```

### Vercel Environment Variables
```
SUPABASE_URL              = https://wklhcmaodxatavuoduhd.supabase.co
SUPABASE_SERVICE_ROLE_KEY = [Supabase Settings > API > service_role]
PAYSTACK_SECRET_KEY       = [Paystack Dashboard > Settings > API]
```

### Webhook URL (set in Paystack Dashboard → Settings → API → Webhook URL)
```
https://afams-webhook.vercel.app/api/paystack-webhook
```
Replace `afams-webhook` with your actual Vercel project slug after deploy.

### CORS / Domain restriction
The webhook only receives POST from Paystack's servers — no CORS config needed.
Paystack always sends from their IPs; signature verification is the security layer.

---

## TRUEHOST SETUP

### File deployment
- Upload all HTML/CSS/JS files via **cPanel → File Manager → public_html/**
- `index.html` must be at root: `public_html/index.html`
- Admin files: `public_html/admin/login.html`, `public_html/admin/dashboard.html`

### SSL
cPanel → SSL/TLS → **Let's Encrypt** → Issue certificate for `afams.co.ke` + `www.afams.co.ke`  
One click. Auto-renews every 90 days.

### Custom Email (the whole point)
cPanel → **Email Accounts** → Create:
```
orders@afams.co.ke    ← for Paystack receipts + order comms
info@afams.co.ke      ← general enquiries
monar@afams.co.ke     ← or your preferred name
```
Access via **Webmail** (cPanel) or configure in Gmail:
- Gmail → Settings → Accounts → Add another email address
- SMTP: mail.afams.co.ke | Port: 465 (SSL) or 587 (TLS)
- Username: orders@afams.co.ke | Password: [set in cPanel]

This lets you send + receive `@afams.co.ke` mail directly from Gmail. Free.

### DNS
Registrar → Nameservers → point to Truehost only:
```
ns1.truehost.co.ke
ns2.truehost.co.ke
```
Remove all Cloudflare and Netlify nameservers. Do not mix.

---

## PAYSTACK CHECKOUT (updated webhook URL)

Only change from previous: update the metadata + webhook target.  
In your checkout HTML, the Paystack handler callback is unchanged.  
Only the webhook URL in Paystack Dashboard changes to the Vercel URL above.

---

## WHAT TO DO ON NETLIFY

1. **Remove custom domain**: Netlify Dashboard → Your Site → Domain Management → Remove `afams.co.ke`
2. Optionally delete the Netlify site entirely — it served no orders, nothing to preserve.
3. The `netlify.toml` and `netlify/functions/` folder in your repo can be deleted.

---

## DEBUGGING CHECKLIST

| Issue | Check |
|-------|-------|
| Webhook 401 | `PAYSTACK_SECRET_KEY` not set in Vercel env vars |
| Webhook not receiving | Paystack Dashboard webhook URL not updated to Vercel URL |
| Site 404 on Truehost | `index.html` not in `public_html/` root |
| SSL not working | Re-issue Let's Encrypt cert after DNS propagation completes |
| Email not sending | SMTP port blocked — try 587 if 465 fails |
| Gmail send-as failing | Check SPF record in Truehost DNS: `v=spf1 include:truehost.co.ke ~all` |
