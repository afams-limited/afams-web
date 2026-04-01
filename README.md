# Afams Ltd — afams.co.ke

**Farming into the future**

Official website for Afams Ltd — urban agricultural technology company based in Nairobi, Kenya.

## Stack

- Pure HTML5 / CSS3 / Vanilla JavaScript — zero frameworks, zero build step
- Paystack for payments (M-Pesa, cards, mobile money)
- Google Fonts (Inter)
- Deployed on Netlify via GitHub

## Quick Deploy to Netlify

1. Push this repo to GitHub
2. Go to app.netlify.com → Add new site → Import an existing project
3. Select GitHub and choose this repository
4. Set **Publish directory** to `.` (the repo root)
5. Click Deploy site

Your site is live in ~60 seconds.

## After deploying — critical setup steps

### 1. Add your Paystack public key
Open `assets/js/app.js` and replace line 5:
```js
paystackKey: 'pk_live_YOUR_PAYSTACK_PUBLIC_KEY_HERE',
```
with your actual Paystack **public** key (starts with `pk_live_` or `pk_test_`).

### 2. Add your WhatsApp number
```js
whatsapp: '+254700000000',
```
Replace with your actual WhatsApp business number including country code.

### 3. Add your product images
Place your product images in `assets/images/` with these exact filenames:
- `farmbag-classic.jpg` — FarmBag Classic rooftop photo
- `farmbag-vertical.jpg` — FarmBag Vertical with Grow Cube photo


Images gracefully fallback to emoji placeholders if not found.

### 4. Custom domain (afams.co.ke)
In Netlify Dashboard → Project → Domain management → Add a domain → `afams.co.ke`
Netlify provides the DNS records to add in TrueHost.

## File structure
```
afams-web/
├── index.html              # Main website (single page)
├── admin.html              # Admin panel
├── netlify.toml            # Netlify configuration + security headers
├── assets/
│   ├── css/
│   │   ├── style.css       # All styles (dark mode ready, fully responsive)
│   │   └── admin.css       # Admin panel styles
│   ├── js/
│   │   ├── app.js          # Cart, Paystack, animations, all JS
│   │   └── admin.js        # Admin panel JS
│   └── images/             # Product images
├── netlify/
│   └── functions/          # Netlify serverless functions (Paystack API)
└── README.md
```

## Features
- ✅ Pre-order system (Tesla-style — pay now, receive in 3 days)
- ✅ Cart drawer with quantity management
- ✅ Paystack checkout popup (M-Pesa, Visa, Mastercard, Airtel, T-Kash)
- ✅ Order confirmation modal with delivery timeline
- ✅ Persistent cart (localStorage)
- ✅ WhatsApp float button
- ✅ Scroll animations (IntersectionObserver)
- ✅ Fully mobile responsive
- ✅ Newsletter capture
- ✅ FAQ accordion
- ✅ Product badge system
- ✅ 8-country presence section
- ✅ Institutional clients section
- ✅ Founder story section
- ✅ Toast notifications
- ✅ SEO meta tags (Open Graph)
- ✅ Security headers via netlify.toml

## Contact
info@afams.co.ke · orders@afams.co.ke · afams.co.ke · Nairobi, Kenya
