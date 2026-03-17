const PLAN_LIMITS = {
  free: 25,
  pro: 100,
  pro_plus: 1000,
};

const TRANSLATION_LIMIT_FREE = 10;

function getPlanLimit(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

function getTranslationLimit(plan) {
  if (plan === "pro" || plan === "pro_plus") return null; // unlimited
  return TRANSLATION_LIMIT_FREE;
}

module.exports = {
  PLAN_LIMITS,
  TRANSLATION_LIMIT_FREE,
  getPlanLimit,
  getTranslationLimit,
};