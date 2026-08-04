# Heart on iPad — no computer needed

This version works with just Safari on your iPad. No Xcode, no Android Studio, no Mac.

**Why hosting is required:** Face ID (via WebAuthn) and the camera only work when a page is served over HTTPS — not when opened as a local file. So the one extra step is putting these files somewhere with a real web address. GitHub Pages is free and you can do the whole thing from Safari on your iPad.

## Step 1 — Add your API key

Open `js/chat.js` in any text editor (even the iPad Files app's Notes-style editors, or GitHub's own web editor in step 3) and replace:

```js
const ANTHROPIC_API_KEY = "YOUR_API_KEY_HERE";
```

with your real key from https://console.anthropic.com.

⚠️ This key will be visible to anyone who finds your page's URL — keep the repo **private**, and don't share the link. This setup is for personal use only.

## Step 2 — Create a GitHub account (if you don't have one)

Go to github.com in Safari, sign up. Free.

## Step 3 — Create a repository and upload the files

1. Tap the **+** in the top right → **New repository**
2. Name it something like `heart-app`, set it to **Private**, create it
3. On the repo page, tap **Add file → Upload files**
4. Upload every file from this folder, keeping the same structure:
   ```
   index.html
   manifest.json
   css/style.css
   js/app.js
   js/chat.js
   js/face.js
   js/webauthn-lock.js
   icons/icon-192.png
   icons/icon-512.png
   icons/apple-touch-icon.png
   ```
   (Safari lets you pick multiple files/folders from the Files app in this upload dialog.)
5. Commit the upload

## Step 4 — Turn on GitHub Pages

1. In your repo, tap **Settings** → **Pages** (left sidebar)
2. Under "Source," choose the `main` branch, save
3. GitHub gives you a URL like `https://yourusername.github.io/heart-app/` — wait a minute or two for it to go live

> Note: GitHub Pages actually only serves **public** repos for free Pages hosting. If you set the repo private, you have two options: (a) make the repo public — fine since there's no other sensitive data, just don't share the URL publicly, since the API key inside is the real thing to protect, or (b) use a host that supports private hosting like Netlify or Vercel (both have free tiers and a similar drag-and-drop upload flow from their website in Safari). If you go public, at minimum don't put the URL anywhere public — it's not indexed by search engines by default, but treat it as "unlisted, not secret."

## Step 5 — Open it and add to home screen

1. Visit your `https://....github.io/heart-app/` URL in **Safari** (must be Safari, not Chrome, for "Add to Home Screen" to create a proper standalone app on iOS)
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen**
3. Name it "Heart," tap Add

You now have a real Heart icon on your home screen. Tapping it opens a fullscreen app — no browser bar, no address bar.

## First launch

1. **Set up Face ID** — tap "Enable Face ID," follow the prompt (this is your iPad's real Face ID, via the browser's WebAuthn API)
2. **Face enrollment** (optional, for mood/recognition) — look at the camera, capture
3. You're in. Tap the camera icon top-right anytime to turn mood sensing on/off

## If something doesn't work

- **Face ID button does nothing / errors**: almost always means it's not being served over HTTPS. Double check you're using the `https://...github.io` URL, not a local file.
- **Camera won't turn on**: Safari will ask for camera permission the first time — if you accidentally denied it, go to iPad Settings → Safari → Camera → allow for that website.
- **Chat says "check your API key"**: re-check `js/chat.js` has your real key, and re-upload/re-commit that file to GitHub, then reload the page.
