# Supabase Users Table Setup

## 1. Create the table

Run this in **Supabase Dashboard → SQL Editor**:

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

-- Allow service role to access (bypasses RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (true) WITH CHECK (true);
```

If you prefer a different table name (e.g. `user_usage` to avoid conflicts), create it and set `DB_TABLE_NAME=user_usage` in `.env` and Render.

## 2. Stripe webhook (for upgrades)

For plan upgrades to work after payment:

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Add endpoint: `https://replymate-backend-bot8.onrender.com/stripe/webhook`
3. Select event: `checkout.session.completed`
4. Copy the **Signing secret** and add to Render env as `STRIPE_WEBHOOK_SECRET`

Without this, payments complete but the plan/usage won't update.
