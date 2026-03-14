# Google Sign-In Setup for ReplyMate

If you see **"Authorization page could not be loaded"** when signing in with Google, follow these steps.

## 1. Get Your Extension ID

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Find ReplyMate and copy its **ID** (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)

## 2. Configure Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   ```
   https://<YOUR_EXTENSION_ID>.chromiumapp.org/
   ```
   Example: `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`
4. Click **Save**

## 3. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com) → your project
2. **APIs & Services** → **Credentials**
3. Open the **Web application** OAuth 2.0 client ID (the one used by Supabase)
4. Under **Authorized redirect URIs**, ensure this is present:
   ```
   https://cmmoirdihefyswerkkay.supabase.co/auth/v1/callback
   ```
5. Under **Authorized JavaScript origins**, add (if not already):
   ```
   https://cmmoirdihefyswerkkay.supabase.co
   ```
6. Click **Save**

## 4. Keep Extension ID Stable (Optional)

If you reload the extension often, the ID can change. To keep it stable:

1. Upload the extension to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (you can leave it unpublished)
2. In the Package tab, click **View public key**
3. Copy the public key (single line, no newlines)
4. Add to `manifest.json`:
   ```json
   "key": "YOUR_PUBLIC_KEY_HERE"
   ```
5. Remove the `key` field before publishing to the store

## 5. Verify Setup

- Reload the extension
- Refresh any open Gmail tabs
- Try signing in again

## Still Not Working?

- Check the browser console (F12) for errors
- Ensure the extension has `identity` and `https://accounts.google.com/*` permissions
- Try in an incognito window (with the extension enabled) to rule out cache/cookies
