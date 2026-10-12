# MNMWhole production migration

This branch preserves the original Express + React wholesale application and adds Clerk account registration/sign-in. **It has not been deployed**. The live chaimh.com portfolio and static catalog are on the main branch and remain independent.

## Website structure

- https://mnmwhole.com/sign-in — Clerk user login
- https://mnmwhole.com/sign-up — Clerk registration
- https://mnmwhole.com/ — catalog (Clerk session required)
- https://mnmwhole.com/admin — owner dashboard and inventory uploads (owner Clerk ID only)

## Required Clerk setup

1. Create a Clerk application in https://dashboard.clerk.com.
2. Enable your preferred sign-in methods (e.g., email).
3. Configure production for mnmwhole.com in Clerk, including any DNS records Clerk specifies.
4. Configure the server host environment variables: CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_OWNER_USER_ID (exact Clerk user ID).
5. Set VITE_CLERK_PUBLISHABLE_KEY for the build step (same publishable key; *not* secret).
6. Deploy only after verifying the signed-in owner can edit products, normal customers cannot reach admin API, and unauthenticated users cannot browse the catalog.

Do not commit the secret key, user passwords, or session secrets to git.

## Server hosting and persistence

This branch uses **Node/Express**, the local filesystem for a JSON store, and local upload files. **It cannot run unchanged on Cloudflare Pages or Cloudflare Workers**. Cloudflare can manage DNS for mnmwhole.com, but the backend needs either:

- A Node-capable host with a persistent disk (e.g. Render disk, paid plan if required); or
- A rewrite to Cloudflare Workers + D1 database + R2 object storage.

For a Node host, build command: `npm ci && npm run build` (regenerate and commit package-lock.json after adding Clerk dependencies), start command: `npm start`. Mount a persistent disk and set DATA_DIR to that path. A service without persistent storage will lose your catalog and uploaded images after redeployment.

Point mnmwhole.com and (optional) www.mnmwhole.com to the actual hosting provider using its documented Cloudflare DNS records. Do not point this full-stack app at GitHub Pages.

## Safety before launch

- Customer accounts: Clerk
- Owner access: Clerk authenticated user ID from CLERK_OWNER_USER_ID; legacy admin password login disabled on this branch
- Catalog: login required
- Payments: STRIPE_ENABLED=false until verified Stripe configuration and webhook tests
- Install exact dependency versions and build/test locally before connecting production traffic
- If the site is to be public instead of sign-in-gated, change that intentionally before deployment

### Current status

Source migration and Clerk code integrated in `mnmwhole-production`. Still pending: Clerk application and keys, hosted Node runtime with persistent storage (or Workers rewrite), domain DNS, tests, and live deployment.
