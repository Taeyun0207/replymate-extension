const { createClient } = require("@supabase/supabase-js");

// Use service role key for server-side table access (bypasses RLS); fallback to anon key
// Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase Dashboard → Settings → API)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Supabase table: user_usage (avoids conflict with auth.users)
// Run in Supabase SQL Editor:
// CREATE TABLE IF NOT EXISTS public.user_usage (
//   user_id TEXT PRIMARY KEY,
//   plan TEXT NOT NULL DEFAULT 'free',
//   used INTEGER NOT NULL DEFAULT 0,
//   billing_cycle_start TIMESTAMPTZ NOT NULL,
//   next_reset_at TIMESTAMPTZ NOT NULL,
//   stripe_customer_id TEXT,
//   stripe_subscription_id TEXT,
//   created_at TIMESTAMPTZ NOT NULL,
//   updated_at TIMESTAMPTZ NOT NULL
// );
// ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Service role full access" ON public.user_usage FOR ALL USING (true) WITH CHECK (true);
const TABLE_NAME = process.env.DB_TABLE_NAME || "users";

// Column names: Postgres lowercases unquoted identifiers (userId -> userid)
const COLS = {
  id: "userid",
  plan: "plan",
  used: "used",
  billingCycleStart: "billingcyclestart",
  nextResetAt: "nextresetat",
  stripeCustomerId: "stripecustomerid",
  stripeSubscriptionId: "stripesubscriptionid",
  createdAt: "createdat",
  updatedAt: "updatedat",
};

function toRow(obj) {
  if (!obj) return null;
  return {
    userId: obj[COLS.id] ?? obj.user_id ?? obj.userId,
    plan: obj[COLS.plan] ?? "free",
    used: obj[COLS.used] ?? 0,
    billingCycleStart: obj[COLS.billingCycleStart] ?? obj.billing_cycle_start ?? obj.billingCycleStart,
    nextResetAt: obj[COLS.nextResetAt] ?? obj.next_reset_at ?? obj.nextResetAt,
    stripeCustomerId: obj[COLS.stripeCustomerId] ?? obj.stripe_customer_id ?? obj.stripeCustomerId,
    stripeSubscriptionId: obj[COLS.stripeSubscriptionId] ?? obj.stripe_subscription_id ?? obj.stripeSubscriptionId,
    createdAt: obj[COLS.createdAt] ?? obj.created_at ?? obj.createdAt,
    updatedAt: obj[COLS.updatedAt] ?? obj.updated_at ?? obj.updatedAt,
  };
}

function toDb(obj) {
  return {
    [COLS.id]: obj.userId,
    [COLS.plan]: obj.plan,
    [COLS.used]: obj.used,
    [COLS.billingCycleStart]: obj.billingCycleStart,
    [COLS.nextResetAt]: obj.nextResetAt,
    [COLS.stripeCustomerId]: obj.stripeCustomerId ?? null,
    [COLS.stripeSubscriptionId]: obj.stripeSubscriptionId ?? null,
    [COLS.createdAt]: obj.createdAt,
    [COLS.updatedAt]: obj.updatedAt,
  };
}

async function getUser(userId) {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const nextResetDefault = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: row, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq(COLS.id, userId)
    .maybeSingle();

  if (error) {
    console.error("[DB] Supabase getUser error:", error.message);
    throw error;
  }

  if (row) {
    const r = toRow(row);
    const nextResetMs = new Date(r.nextResetAt).getTime();
    if (isNaN(nextResetMs)) {
      console.warn("[DB] Invalid nextResetAt for user:", userId, r.nextResetAt);
    }
    if (nowMs >= nextResetMs) {
      const newCycleStart = new Date(nowMs).toISOString();
      const nextReset = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
      console.log("[DB] Monthly reset triggered for user:", userId);

      const { data: updated, error: updateErr } = await supabase
        .from(TABLE_NAME)
        .update({
          [COLS.used]: 0,
          [COLS.billingCycleStart]: newCycleStart,
          [COLS.nextResetAt]: nextReset,
          [COLS.updatedAt]: now,
        })
        .eq(COLS.id, userId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return toRow(updated);
    }
    return r;
  }

  // Create new user
  const { data: inserted, error: insertErr } = await supabase
    .from(TABLE_NAME)
    .insert(
      toDb({
        userId,
        plan: "free",
        used: 0,
        billingCycleStart: now,
        nextResetAt: nextResetDefault,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: now,
        updatedAt: now,
      })
    )
    .select()
    .single();

  if (insertErr) {
    console.error("[DB] Insert user failed:", insertErr.message, insertErr.details);
    throw insertErr;
  }
  console.log("[DB] User created:", userId);
  return toRow(inserted);
}

async function updateUserPlan(
  userId,
  plan,
  stripeCustomerId = null,
  stripeSubscriptionId = null
) {
  const now = new Date().toISOString();
  const nextReset = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const existingUser = await getUser(userId);

  if (existingUser) {
    console.log("[DB] Updating existing user plan:", userId, "to:", plan);
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        [COLS.plan]: plan,
        [COLS.used]: 0,
        [COLS.billingCycleStart]: now,
        [COLS.nextResetAt]: nextReset,
        [COLS.stripeCustomerId]: stripeCustomerId ?? existingUser.stripeCustomerId,
        [COLS.stripeSubscriptionId]: stripeSubscriptionId ?? existingUser.stripeSubscriptionId,
        [COLS.updatedAt]: now,
      })
      .eq(COLS.id, userId)
      .select()
      .single();

    if (error) {
      console.error("[DB] Update plan failed:", error.message, error.details);
      throw error;
    }
    return toRow(data);
  }

  console.log("[DB] Inserting new user with plan:", userId, plan);
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(
      toDb({
        userId,
        plan,
        used: 0,
        billingCycleStart: now,
        nextResetAt: nextReset,
        stripeCustomerId,
        stripeSubscriptionId,
        createdAt: now,
        updatedAt: now,
      })
    )
    .select()
    .single();

  if (error) {
    console.error("[DB] Insert user with plan failed:", error.message, error.details);
    throw error;
  }
  return toRow(data);
}

async function recordUsage(userId) {
  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from(TABLE_NAME)
    .select(COLS.used)
    .eq(COLS.id, userId)
    .single();

  if (fetchErr || !row) throw fetchErr || new Error("User not found");

  const newUsed = (row[COLS.used] ?? row.used ?? 0) + 1;
  const { error: updateErr } = await supabase
    .from(TABLE_NAME)
    .update({ [COLS.used]: newUsed, [COLS.updatedAt]: now })
    .eq(COLS.id, userId);

  if (updateErr) {
    console.error("[DB] recordUsage failed:", updateErr.message, updateErr.details);
    throw updateErr;
  }
  console.log("[DB] Usage incremented for user:", userId);
  return 1;
}

function closeDatabase() {
  // No-op: Supabase client does not require explicit connection close
}

async function testConnection() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(COLS.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return true;
}

module.exports = {
  getUser,
  updateUserPlan,
  recordUsage,
  closeDatabase,
  testConnection,
};
