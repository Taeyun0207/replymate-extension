#!/usr/bin/env node
/**
 * Generate a Chrome extension "key" for stable extension ID during development.
 * Run: node scripts/generate-extension-key.js
 * Requires: openssl (install via Git for Windows, or WSL, or Chocolatey).
 * Output: base64 public key to add to manifest.json "key" field.
 * See: https://developer.chrome.com/docs/extensions/mv3/manifest/key
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

try {
  const tmpDir = path.join(__dirname, "../.tmp-keygen");
  fs.mkdirSync(tmpDir, { recursive: true });
  const keyPath = path.join(tmpDir, "key.pem");
  execSync(`openssl genrsa 2048 2>nul | openssl pkcs8 -topk8 -nocrypt -out "${keyPath}" 2>nul`, {
    stdio: "pipe",
    shell: true,
  });
  const pubDer = execSync(`openssl rsa -in "${keyPath}" -pubout -outform DER 2>nul`, {
    encoding: null,
    shell: true,
  });
  fs.rmSync(keyPath, { force: true });
  fs.rmdirSync(tmpDir, { force: true });
  const key = pubDer.toString("base64").replace(/\n/g, "");
  console.log("Add this to manifest.json \"key\" field:");
  console.log(key);
} catch (e) {
  console.error("OpenSSL not found. Install OpenSSL (e.g. Git for Windows includes it) and retry.");
  console.error("Or generate manually: openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem");
  console.error("Then: openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A");
  process.exit(1);
}
