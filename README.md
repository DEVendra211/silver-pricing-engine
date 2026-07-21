# MAA SILVER — Dynamic Silver Rate Pricing Engine

Update one number — today's silver rate — and every product's price recalculates
across the whole store (product page, collections, search, cart, checkout).

## How it works

Shopify's cart and checkout always charge whatever is in the real
`variant.price`. There's no safe way to show a different price on the
storefront while checkout charges something else. So instead of faking
prices with JavaScript, this engine **writes the real variant price** whenever
you recalculate — every page just displays that real price as normal, no
theme changes needed for collections/search/cart/checkout.

```
Silver Value   = Weight (g) × Today's Rate (₹/g)
Making Charges = Silver Value × (Making Charges % / 100)
Subtotal       = Silver Value + Making Charges + Packaging Charges + Profit Margin
Final Price    = Subtotal × 1.03   (3% GST)
```

Weight, making charges %, packaging charges, and profit margin can each be set
at the **product** level (default for all variants) and optionally overridden
per **variant** (e.g. a heavier size). If a variant doesn't set its own value,
the product's value is used.

## One-time setup

Shopify retired the old "Settings → Develop apps → static token" flow for
*new* custom apps. Apps are now created in the **Dev Dashboard**
(dev.shopify.com), and instead of a token you copy once, you get a
Client ID + Client secret that the app exchanges for a short-lived (24h)
token automatically — `lib/shopifyAdmin.js` already handles that refresh.

1. Go to **dev.shopify.com** and sign in with your Shopify account.
2. **Apps → Create app**. Name it e.g. "Silver Pricing Engine".
3. Under **Settings → Access scopes** (or during setup), add:
   `read_products, write_products, read_metaobjects, write_metaobjects`.
4. **Settings** page → copy the **Client ID** and **Client secret**.
5. Install the app on your store — there's an "install" / "select store"
   step in the Dev Dashboard flow. It must land on **maa-silver.myshopify.com**
   specifically.
   - If you hit a `shop_not_permitted` error later, it means the app and the
     store aren't in the same Shopify organization — check **Dev stores** in
     the sidebar of the Dev Dashboard and confirm this store is listed there.
6. `cp .env.example .env` and fill in `SHOPIFY_STORE_DOMAIN`,
   `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`.
7. `npm install`
8. `npm run setup-metafields` — creates the product/variant metafield
   definitions listed below (safe to re-run).
9. `npm run setup-rate-metaobject` — creates the "Silver Rate Settings"
   metaobject (definition + one entry, defaulted to 0) so the rate is
   editable in Shopify admin (safe to re-run).

## Today's rate — editable directly in Shopify admin

The rate lives in a **Metaobject** (not a shop metafield), specifically so the
store owner can edit it natively in Shopify admin without any custom app,
token, or local tool:

**Shopify admin → Content → Metaobjects → Silver Rate Settings → "current-rate"
entry → edit "Today's Silver Rate (₹/gram)" → Save.**

That's the whole daily update, for whoever is doing it — no terminal, no
`npm start`, nothing technical required.

## Product/variant metafield reference

All under namespace `silver_pricing`. These have a native admin UI too: open
any product → scroll to the **Metafields** section.

| Owner | Key | Type | Notes |
|---|---|---|---|
| Product | `weight_grams` | number_decimal | Default silver weight |
| Product | `making_charges_percent` | number_decimal | |
| Product | `packaging_charges` | number_decimal | |
| Product | `profit_margin` | number_decimal | |
| Product variant | `weight_grams` | number_decimal | Optional override |
| Product variant | `making_charges_percent` | number_decimal | Optional override |
| Product variant | `packaging_charges` | number_decimal | Optional override |
| Product variant | `profit_margin` | number_decimal | Optional override |

## Daily workflow

1. Whoever sets the rate updates it in Shopify admin (Content → Metaobjects →
   Silver Rate Settings), as above.
2. Someone with this tool installed runs:
   ```
   npm start
   ```
   Open http://localhost:3456 and click **Recalculate All Prices**. (The rate
   field on this panel is optional/secondary — it writes to the same
   metaobject, so either place works, but Shopify admin is the intended
   day-to-day spot since it needs no setup.)
3. Review the summary — it tells you how many variants updated, and lists any
   product missing a required metafield (those are left untouched, not broken).

## Theme files

Two files in `theme-snippets/` are ready to upload to the live theme once the
Shopify connection is back:

- `silver-price-breakdown.liquid` → upload as a theme **snippet**, then
  `{% render 'silver-price-breakdown' %}` on the product page (e.g. inside
  `sections/main-product.liquid`, near the price). Shows customers the
  silver value / making charges / packaging / profit / GST breakdown, and
  recomputes instantly when they switch variants. If any metafield is
  missing it shows a plain fallback message instead of breaking the page.
- `silver-price-breakdown.js` → upload as a theme **asset**.

This breakdown is informational only — the price actually charged is always
the real Shopify variant price kept in sync by `npm start` → Recalculate.

## Deploy for free (so it's a URL, not a localhost tool)

The panel is a normal small Express app, so any free Node host works. Two
options — pick whichever service you're comfortable creating a free account
with. Either way, **set `ADMIN_PASSWORD`** (and optionally `ADMIN_USERNAME`,
default `admin`) in the host's environment variables — every route is behind
HTTP Basic Auth once it's not just on your own laptop, since the URL will be
reachable by anyone who has it otherwise.

### Option A — Render (zero code changes, simplest)

1. Push this folder to a new GitHub repo.
2. Create a free account at render.com, click **New → Blueprint**, connect
   the repo. Render reads `render.yaml` automatically.
3. When prompted, fill in the environment variables: `SHOPIFY_STORE_DOMAIN`,
   `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD`.
4. Deploy. You'll get a URL like `https://silver-pricing-engine.onrender.com`.
   Free tier sleeps after 15 min idle, so the first load after a while takes
   ~30s to wake up — fine for a once-a-day tool.

### Option B — Vercel (faster cold starts, one extra file already added)

1. Push this folder to a new GitHub repo (or run `npx vercel` from this
   folder directly — no GitHub required).
2. Create a free account at vercel.com, **Add New → Project**, import the
   repo (or follow the CLI prompts if using `npx vercel`).
3. In the project's **Settings → Environment Variables**, add the same 5
   variables as above.
4. Deploy. `vercel.json` + `api/index.js` already route everything through
   the same Express app — no further changes needed.

Either way: once deployed, bookmark the URL, log in with the Basic Auth
credentials you set, and use it exactly like the localhost version.

## Files

```
app.js                            Express app (routes + middleware) — no .listen()
server.js                         Local runner: node server.js -> localhost:3456
api/index.js                      Serverless entry point for Vercel
vercel.json                       Vercel routing config
render.yaml                       Render Blueprint config
lib/pricing.js                    Pure pricing formula + validation (unit-testable)
lib/shopifyAdmin.js               Admin GraphQL client
lib/shopRate.js                   Get/set today's rate (Metaobject: silver_rate_settings)
lib/recalculate.js                Fetches all products, computes, bulk-updates prices
lib/basicAuth.js                  Password-gates the whole app once it's hosted publicly
lib/createMetafieldDefinitions.js One-time metafield setup script
lib/createRateMetaobject.js       One-time metaobject setup script
public/                           Admin panel UI (rate input + Recalculate button)
theme-snippets/                   Liquid + JS for the product-page price breakdown
```

## Notes / next steps

- Currently wired for **manual** recalculation (you click the button after
  updating the rate). If you later want it fully automatic (e.g. daily cron,
  or instant-on-save via Shopify Flow), `lib/recalculate.js` is already
  factored out so it can be called from a scheduled job or a webhook handler
  without changes — it just needs a host to run on.
- `productVariantsBulkUpdate` is called once per product (grouped), so large
  catalogs stay well within API rate limits, but a full-catalog recalculation
  can take a minute or two — the panel shows a summary when it's done.
