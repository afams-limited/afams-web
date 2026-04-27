# Copilot Prompt — 01: Add GrowBag to Existing Product Data
# Scope: Add GrowBag entries to the existing products array/object in the site JS.
# Rule: Do NOT touch FarmBag Classic, FarmBag Vertical, or ProSoil entries.
#       Do NOT change cart logic, checkout, or Paystack integration.
#       Only ADD new entries. Follow the exact same data structure already in use.

---

## Context

The site at afams.co.ke has a products array in its main JavaScript file (likely `js/main.js`,
`js/products.js`, `js/app.js`, or inline in `index.html` — find it by searching for
`'FarmBag Classic'` or `farmbag-classic` in the codebase).

The existing products follow a consistent data structure. Identify that structure exactly —
field names, property types, SKU format, price format — and replicate it precisely for
the new GrowBag entries below.

---

## New Product: Afams GrowBag

The GrowBag is a new, simpler product line being added below the existing FarmBags.
It comes in **5 sizes × 2 shape variants = 10 SKUs total**.

### Shape variants
- **Wide** — standard cylindrical shape, broad and squat. Similar footprint to the existing
  FarmBag Classic. Best for balconies, rooftops, and patios where floor space is available.
- **Compact** — narrower and taller profile. Best for small balconies, tight corners,
  and spaces where width is limited.

### Size + pricing matrix

| Size     | SKU Wide      | SKU Compact      | Wide Price (KES) | Compact Price (KES) | Volume Wide | Volume Compact |
|----------|---------------|------------------|------------------|---------------------|-------------|----------------|
| Mini     | GB-MINI-W     | GB-MINI-C        | 550              | 500                 | 8 L         | 6 L            |
| Medium   | GB-MED-W      | GB-MED-C         | 850              | 800                 | 17 L        | 14 L           |
| Standard | GB-STD-W      | GB-STD-C         | 1,050            | 950                 | 32 L        | 28 L           |
| Large    | GB-LRG-W      | GB-LRG-C         | 1,450            | 1,350               | 50 L        | 44 L           |
| XL       | GB-XL-W       | GB-XL-C          | 1,950            | 1,800               | 70 L        | 62 L           |

### Product details (apply to all GrowBag SKUs)
```
product_line: 'growbag'
name: 'Afams GrowBag'
tagline: 'Grow anywhere. No system needed.'
description: 'The Afams GrowBag is a forest green PP geotextile grow bag with a bonded
black polythene liner, 12 brass drainage grommets, and reinforced carry handles.
No irrigation. No wicking system. Just a well-made bag that holds soil and grows food.
Available in Wide and Compact shapes, five sizes.'
material: 'PP geotextile woven, 150 GSM, UV-stabilised'
liner: 'Black LDPE polythene, 250 micron, food-safe'
grommets: 12
image: 'assets/images/growbag-[size]-[variant].jpg'
  (e.g. 'assets/images/growbag-standard-wide.jpg')
  (use 'assets/images/growbag-standard-wide.jpg' as placeholder for ALL sizes/variants
   until real images are added — we will replace image paths later)
category: 'growbag'
badge: null   (no badge — unless size is Standard Wide, which gets badge: 'Most Popular')
in_stock: true
phase: 1
```

### Best for (by size)
```
Mini:     ['Herbs', 'Chillies', 'Spring onions', 'Microgreens']
Medium:   ['Spinach', 'Sukuma wiki', 'Capsicum', 'Lettuce']
Standard: ['Kale', 'Beans', 'Capsicum', 'Coriander', 'Spinach']
Large:    ['Tomatoes', 'Aubergine', 'Large kale', 'Capsicum']
XL:       ['Tomatoes', 'Sweet potato', 'Multi-plant', 'Large crops']
```

---

## Implementation instructions

1. **Find** the existing products array/object in the codebase. Search for `'FarmBag Classic'`
   or `farmbag-classic` to locate it.

2. **Inspect** the exact data structure of one existing product entry — every field name,
   value type, and pattern.

3. **Add** all 10 GrowBag SKU entries at the END of the existing products array,
   after ProSoil. Do not reorder existing entries.

4. **Match** the exact field names and structure of existing entries. If existing entries
   use `productName`, use `productName` — not `name`. If they use `priceKES`, use
   `priceKES`. Do not invent new field names unless the GrowBag genuinely needs them
   (size, variant, volume — these are new and must be added).

5. **Add these three new fields** that GrowBag entries need and existing products don't have:
   ```
   size: 'Mini' | 'Medium' | 'Standard' | 'Large' | 'XL'
   variant: 'Wide' | 'Compact'
   volume: '8 L'   // string, matches values in matrix above
   ```
   These fields will be used by the product card selector (Prompt 02).

6. **Do not add** a separate section label or category header in the data — that is handled
   in the HTML (Prompt 02).

---

## Checklist after implementation
- [ ] Exactly 10 new GrowBag entries added to products array
- [ ] Existing 3 products (FarmBag Classic, FarmBag Vertical, ProSoil) untouched
- [ ] All 10 entries follow the exact same field structure as existing products
- [ ] `size`, `variant`, `volume` fields present on all 10 GrowBag entries
- [ ] SKU codes match the matrix exactly (GB-MINI-W, GB-MINI-C, etc.)
- [ ] Standard Wide entry has badge: 'Most Popular' (or equivalent badge field)
- [ ] All other GrowBag entries have null/empty badge
- [ ] Placeholder image path used consistently for all 10 entries
- [ ] No syntax errors — array is valid JS after additions
