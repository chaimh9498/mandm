# Chaim H. Projects Portfolio

This is the standalone portfolio for https://chaimh.com. It is separate from the `mandm` storefront source code.

## Publish with GitHub Pages

1. Use your existing public GitHub repository **`chaimh9498/mandm`**. The portfolio website lives in its **`docs/`** folder; the M&M catalog backend remains outside that folder.
2. Upload the portfolio files to the **`docs/`** folder in the repository, including `docs/CNAME` and `docs/.nojekyll`.
3. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/docs`.
4. Under **Custom domain**, enter `chaimh.com`, save, then enable **Enforce HTTPS** when available.
5. Set DNS A / AAAA records for the apex to GitHub Pages and `www` CNAME to `chaimh9498.github.io`.

## Project editing

Edit `index.html` to update the project cards, descriptions and email address. Design lives in `styles.css` and small interactions in `app.js`.

## M&M access code

The portfolio's M&M button sends the visitor's code to **https://mandm.chaimh.com/api/customer/access** and never stores the code or checks it in client JavaScript. This requires the separate M&M Node backend to be deployed to that subdomain, with a private `CUSTOMER_ACCESS_CODE` secret and `SESSION_SECRET` configured on the server. The request sets a signed HttpOnly customer cookie and then opens the catalog. Until the backend is online, the portfolio will correctly show that access is unavailable.

**Never place the access code in GitHub Pages JavaScript, HTML, or a repository.** GitHub Pages cannot securely protect the catalog. The M&M shop must run on backend-capable hosting (and have persistent storage) to enforce access and support future Stripe payments. Use the `mandm` source project, and keep `STRIPE_ENABLED=false` until ready.

Contact email on this site defaults to `hello@chaimh.com` as a placeholder. Replace with an address you control before launch.