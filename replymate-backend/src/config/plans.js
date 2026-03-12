const PLAN_LIMITS = {
  free: 30,
  pro: 300,
  pro_plus: 1000,
};

function getPlanLimit(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

module.exports = {
  PLAN_LIMITS,
  getPlanLimit,
};