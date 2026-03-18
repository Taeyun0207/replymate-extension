# ReplyMate

ReplyMate is a Chrome extension that helps users generate Gmail replies faster.

## Current Features
- Shows a hover-based **Generate Reply** button on Gmail message rows
- Opens the selected email thread automatically
- Scrolls to the reply area
- Opens the Gmail reply box automatically
- Inserts a reply draft automatically
- Supports reply tone selection: **Professional**, **Polite**, **Friendly**
- Supports reply length selection: **Short**, **Medium**, **Long**

## How It Works
- From the Gmail inbox, hover over a message row to reveal the **Generate Reply** button on the right.
- Click the button:
  - ReplyMate opens the email thread.
  - It locates and clicks Gmail’s **Reply** action.
  - It finds the reply editor and inserts a draft reply for you.

## Popup Settings
Open the ReplyMate popup from the Chrome toolbar to configure:

- **Tone**: Professional, Polite, or Friendly
- **Length**: Short, Medium, or Long

These settings are saved using `chrome.storage.local` as:

- `replymateTone`
- `replymateLength`

If no values are saved yet, ReplyMate defaults to:

- **Tone**: Polite  
- **Length**: Medium

## Google Sign-In (Supabase Auth)

ReplyMate requires Google sign-in to generate AI replies. Configure Supabase:

1. **Set environment variables** and build auth config:
   ```bash
   SUPABASE_URL=your_supabase_url SUPABASE_ANON_KEY=your_anon_key node scripts/build-auth-config.js
   ```
   Or edit `replymate-extension/lib/auth-config.js` manually with your Supabase URL and anon key.

2. **Add redirect URL** in Supabase Dashboard → Authentication → URL Configuration:
   - Add `https://YOUR_EXTENSION_ID.chromiumapp.org/` (get your extension ID from `chrome://extensions` after loading the extension)

3. **Enable Google provider** in Supabase Dashboard → Authentication → Providers.

## Development
1. Go to `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `replymate-extension` folder.
4. Open Gmail and test the hover **Generate Reply** button and popup settings.

## Notes
- ReplyMate currently works on the standard Gmail web UI at `https://mail.google.com/`.
- Behavior may change if Gmail updates its DOM structure; the extension uses DOM queries and polling to stay in sync.

## Privacy Policy

ReplyMate respects user privacy and does not store email content.

Privacy Policy:
https://replymateai.app/privacy