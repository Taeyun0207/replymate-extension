# Render.com environment variables

## Why you don’t see `BILLING_SUCCESS_URL` / `BILLING_CANCEL_URL`

Those variables are **optional**. `server.js` uses built-in defaults pointing at your **pricing** page:

- `https://replymateai.app/pricing?success=1`
- `https://replymateai.app/pricing?cancelled=1`

If you never added them in Render, **nothing is wrong** — the defaults apply after each deploy.

Only add `BILLING_SUCCESS_URL` / `BILLING_CANCEL_URL` in Render if you need a **different** domain or path (e.g. staging). If you previously set them to old `/upgrade` URLs, **delete** those keys or update them to `/pricing` and **redeploy**.

## Where to look in Render

1. [dashboard.render.com](https://dashboard.render.com) → log in  
2. Open your **Web Service** (the Node API, e.g. `replymate-backend`)  
3. Left sidebar: **Environment** (or **Settings** → **Environment**)  
4. List = all keys you’ve set. There is no separate “billing” section — only what you added.

Stripe checkout uses your API host first (`/billing/success` → then redirects to the URL built from `BILLING_SUCCESS_URL`). See `server.js` near `create-checkout-session`.

## After changing env

Use **Manual Deploy** → **Deploy latest commit** (or push to connected branch) so the service restarts with new variables.

## Local reference

See `.env.example` in this folder for all common variables.
