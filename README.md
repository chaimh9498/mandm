# M&M Wholesale & Liquidation — Catalog Storefront

A ready-to-customize storefront with a public catalog, shopping bag, seller dashboard, uploads, persistent product storage, order history and an **optional Stripe Checkout integration**.

**Payments are OFF by default.** Nothing charges customers until you explicitly configure Stripe. Six clearly marked wholesale sample listings help you preview the design; sample products can *never* be checked out. Edit or remove them and add your own items.

## Run on your computer

Requirements: **Node.js 20+** and npm.

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Edit `.env` and set a **strong, unique** `ADMIN_PASSWORD` and `SESSION_SECRET` (at least 32 random characters). Then:

```bash
npm run dev
```

Open **http://localhost:5173** for your shop and **http://localhost:5173/admin** for the seller dashboard. Log in with your `ADMIN_PASSWORD`. Use **Products → Add product** to enter title, price, description, inventory, and upload a photo. The site saves updates to `server/data/store.json` and photo uploads to `server/data/uploads/`.

> The M&M logo and visual identity are pre-installed. You can adjust storefront messaging in **Store settings**.

## Included features

- Mobile-friendly product catalog with categories, sorting, product search, product details and inventory-aware bag
- Password-protected seller dashboard with product create/edit/delete, uploaded photos, featured products and visibility controls
- Configurable store name, hero text, announcements and support email
- Optional Stripe-hosted checkout extension in `server/payments/stripe.js`
- Price and stock validated **on the server**, never taken from customer-submitted amounts
- Stripe webhook signature verification and order status updates; seller order list
- No charges or checkout until you opt in and configure the integration

## Connect Stripe later

1. Open your **Stripe Dashboard** and get a **test** secret API key. Do not use publishable keys as `STRIPE_SECRET_KEY`.
2. Set `PUBLIC_BASE_URL` to your actual public storefront origin (for example `https://shop.yourdomain.com`). During local Stripe testing with Vite, leave `http://localhost:5173`.
3. Set `STRIPE_SECRET_KEY=sk_test_...` in `.env`.
4. In Stripe's Developers → Webhooks, register the public endpoint **`https://YOURDOMAIN/api/payments/stripe/webhook`** for the events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
5. Put its `whsec_...` signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Set `STRIPE_ENABLED=true`, then restart the server. Payment buttons will now direct customers to Stripe-hosted Checkout. Use Stripe test cards and verify webhook events update the Orders page.
7. Once ready, switch to Stripe **live** keys and the **live-mode** webhook signing secret; confirm your live webhook and payment setup before going public.

### Optional settings

- `STRIPE_COLLECT_SHIPPING=true`: collect a shipping address (allowed countries from `STRIPE_SHIPPING_COUNTRIES=US,CA`). **It does not charge a shipping fee**; configure shipping charges if your business needs them before accepting live physical orders.
- `STRIPE_AUTOMATIC_TAX=true`: asks Stripe to calculate tax, but **requires Stripe Tax configuration**. Review your tax registration requirements.
- Currency is **USD only** in this starter. No promotions or coupon logic are included.

Your Stripe keys stay server-side. **Never paste secret keys into the website's admin dashboard, git history, or frontend JavaScript.**

## Build / deploy

For a Node.js host with a persistent writable disk:

```bash
npm install
npm run build
NODE_ENV=production npm start
```

`npm start` serves the built storefront and API on port `PORT` (default 3001). The same origin handles both frontend and backend. Set `PUBLIC_BASE_URL` to that origin and point your domain's HTTPS proxy to the Node server. Set `ADMIN_PASSWORD` and `SESSION_SECRET` in your host's secret/environment-variable manager.

**Deployment considerations**

- This is a working **starter application**, not a finished high-volume commerce platform. It uses a local JSON file and local image files. A host without a persistent disk will lose products and uploads. GitHub Pages, Cloudflare Pages alone, or other static-only hosting cannot run its Express backend.
- Use a persistent service or migrate data/images to a hosted database and object storage before significant traffic. The basic stock check does **not** reserve inventory between Stripe session creation and payment; high-demand inventory requires reservation logic and reconciliation to prevent overselling.
- Add shipping fees, tax policy, delivery/returns/privacy terms, refund workflows, fulfillment and customer notifications before launching physical product sales.
- Change the sample `ADMIN_PASSWORD`, set a random `SESSION_SECRET`, enable HTTPS in production, and back up `DATA_DIR` regularly. Avoid sharing `.env`.
- Stripe webhooks are required for the seller dashboard to recognize paid orders. The redirect alone is not proof of payment.
- For production image storage and persistent data, consider a managed database and object storage.

## Project layout

```text
client/src/main.jsx           Product catalog, bag, admin UI
client/src/styles.css         Responsive design
client/public/mm-logo.jpeg     Supplied M&M company logo
client/public/demo/           Placeholder images for demo listings
server/index.js               REST API, auth, image upload, order webhook
server/store.js               Local persistence and sample products
server/payments/stripe.js     Optional Stripe extension (off by default)
.env.example                  Server configuration template
```

## Stripe docs

- https://docs.stripe.com/checkout/quickstart
- https://docs.stripe.com/webhooks

Developed as a customizable first version; review commerce compliance for your region before taking live payments.

## Customer access and main projects portfolio

The **public portfolio** is in `docs/`, hosted on GitHub Pages at **chaimh.com** once configured under Settings → Pages → Deploy from branch `main`, folder `/docs`, custom domain `chaimh.com`.

The **private M&M catalog** is NOT hosted on GitHub Pages. Deploy this Node/Express server on a backend-capable host at `https://mandm.chaimh.com`. Configure `CUSTOMER_ACCESS_CODE` (8+ characters), `SESSION_SECRET`, and `PUBLIC_BASE_URL=https://mandm.chaimh.com` privately in the host. Route the `mandm` DNS record to that host following the host's instructions, NOT to GitHub Pages. The portfolio modal POSTs access codes directly to this backend; the backend checks them and gives an HttpOnly signed cookie. The storefront's product API and checkout are protected. The code is never embedded in browser JavaScript.

For customer access verification from chaimh.com, the backend allows credentialed requests only from `https://chaimh.com` and `https://www.chaimh.com`. The passcode entry and store remain unavailable until the Node server is deployed. Stripe stays disabled by default.