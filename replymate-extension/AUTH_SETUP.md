# ReplyMate Chrome Extension Auth Setup

The extension uses the **Chrome extension native OAuth flow** (not Supabase web redirect).

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create a **Web application** OAuth 2.0 client (not "Chrome app").
3. Add this **Authorized redirect URI**:
   ```
   https://<YOUR_EXTENSION_ID>.chromiumapp.org
   ```
4. Copy the **Client ID** (e.g. `123456789-xxx.apps.googleusercontent.com`).

## 2. Extension ID (stable during development)

To keep the extension ID stable so the redirect URI does not change:

1. Run: `node scripts/generate-extension-key.js` (requires OpenSSL).
2. Add the output to `manifest.json`:
   ```json
   "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
   ```
3. Load the extension in Chrome and note the extension ID from `chrome://extensions`.
4. Use that ID in the redirect URI: `https://<EXTENSION_ID>.chromiumapp.org`.

## 3. Environment and build

1. Add to `replymate-backend/.env`:
   ```
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   ```
2. Run: `node scripts/build-auth-config.js`
   - Generates `lib/auth-config.js` with Supabase URL, anon key, and Google client ID.
   - Patches `manifest.json` oauth2.client_id.

## 4. Supabase

- Enable **Google** provider in Supabase Dashboard → Authentication → Providers.
- No redirect URL configuration needed in Supabase (we use `signInWithIdToken`, not redirect flow).
