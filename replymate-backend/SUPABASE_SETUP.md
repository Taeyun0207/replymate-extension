# Supabase Users Table Setup

## 1. Create the table

Run this in **Supabase Dashboard → SQL Editor** (use snake_case; Postgres lowercases unquoted names):

```sql
CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  used INTEGER NOT NULL DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ NOT NULL,
  next_reset_at TIMESTAMPTZ NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (true) WITH CHECK (true);
```

**If your table has camelCase columns** (userid, billingcyclestart, etc.), rename them to snake_case:

```sql
ALTER TABLE public.users RENAME COLUMN userid TO user_id;
ALTER TABLE public.users RENAME COLUMN billingcyclestart TO billing_cycle_start;
ALTER TABLE public.users RENAME COLUMN nextresetat TO next_reset_at;
ALTER TABLE public.users RENAME COLUMN stripecustomerid TO stripe_customer_id;
ALTER TABLE public.users RENAME COLUMN stripesubscriptionid TO stripe_subscription_id;
ALTER TABLE public.users RENAME COLUMN createdat TO created_at;
ALTER TABLE public.users RENAME COLUMN updatedat TO updated_at;
```

## 2. Stripe webhook (for upgrades)

For plan upgrades to work after payment:

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Add endpoint: `https://replymate-backend-bot8.onrender.com/stripe/webhook`
3. Select event: `checkout.session.completed`
4. Copy the **Signing secret** and add to Render env as `STRIPE_WEBHOOK_SECRET`

Without this, payments complete but the plan/usage won't update.
