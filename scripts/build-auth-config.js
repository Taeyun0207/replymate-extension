#!/usr/bin/env node
/**
 * Build auth-config.js from environment variables.
 * Run: SUPABASE_URL=xxx SUPABASE_ANON_KEY=yyy node scripts/build-auth-config.js
 */
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

const content = `/**
 * Supabase Auth configuration (generated from env).
 * Works in popup, content script, and service worker.
 */
(function() {
  const g = typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : {});
  g.REPLYMATE_SUPABASE_URL = ${JSON.stringify(url)};
  g.REPLYMATE_SUPABASE_ANON_KEY = ${JSON.stringify(key)};
})();
`;

const outPath = path.join(__dirname, "../replymate-extension/lib/auth-config.js");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);
console.log("auth-config.js written to", outPath);
