/**
 * Supabase Auth configuration.
 * Populate via: SUPABASE_URL=xxx SUPABASE_ANON_KEY=yyy node scripts/build-auth-config.js
 * Or create manually - the anon key is safe for client-side use.
 * Works in popup, content script, and service worker.
 */
(function() {
  const g = typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : {});
  g.REPLYMATE_SUPABASE_URL = "";
  g.REPLYMATE_SUPABASE_ANON_KEY = "";
})();
