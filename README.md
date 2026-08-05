# Muffin 🧁

An AI assistant for the CS Initiative club — USACO prep, coding help, debugging, and general
questions. Free tier only: React + Vite frontend, a Cloudflare Worker backend, Groq for the AI
(no accounts, no database — chat history lives in each person's browser).

```
muffin/
  frontend/   React + Vite + Tailwind app (the UI)
  worker/     Cloudflare Worker (the backend that talks to Groq)
```

## How it works

- The frontend is a static site. It can be hosted anywhere static files work (Cloudflare Pages or
  GitHub Pages, per your choice below).
- The worker is a separate, tiny backend that runs on Cloudflare's free plan. It forwards chat
  requests to Groq.
- Nobody's login or personal data is stored anywhere.

---

## Part 0 — One-time setup (things to install/create first)

You only do this once, ever.

1. **Install Node.js** (if you don't have it): go to https://nodejs.org and install the LTS version.
   Verify it worked by opening a terminal and running:
   ```
   node -v
   npm -v
   ```
   Both should print a version number.

2. **Create a free Cloudflare account**: https://dash.cloudflare.com/sign-up

3. **Get a free Groq API key**: go to https://console.groq.com/keys, sign in, and click
   "Create API Key". Copy it somewhere safe — you'll paste it once in Part 1.

4. Open a terminal **inside the `muffin` project folder** for all commands below.

---

## Part 1 — Deploy the backend (Cloudflare Worker)

This is the piece that holds your Groq API key and talks to Groq on the frontend's behalf.

1. Go into the worker folder and install its dependencies:
   ```
   cd worker
   npm install
   ```

2. Log in to Cloudflare from the terminal (this opens a browser window to approve access):
   ```
   npx wrangler login
   ```

3. Set your secret. Wrangler will prompt you to paste the value — it won't be shown on screen,
   that's normal:
   ```
   npx wrangler secret put GROQ_API_KEY
   ```
   (paste the Groq key from Part 0, step 3, then press Enter)

4. Deploy the worker:
   ```
   npx wrangler deploy
   ```
   When it finishes, it prints a URL that looks like:
   ```
   https://muffin-worker.<your-subdomain>.workers.dev
   ```
   **Copy this URL** — you'll paste it into the frontend in Part 2.

You now have a live backend. (It will reject requests from other websites once you set
`ALLOWED_ORIGIN` correctly in step 6 of Part 2 — that's expected and is a safety feature, not a bug.)

---

## Part 2 — Deploy the frontend

Choose **Option A (Cloudflare Pages)** or **Option B (GitHub Pages)**. Cloudflare Pages is simpler
if you're new to this, since everything stays in one place.

### Option A — Cloudflare Pages (recommended)

1. Go into the frontend folder:
   ```
   cd ../frontend
   ```
   (or `cd frontend` if you're at the project root)

2. Create a file named `.env.production` in the `frontend` folder with this content, replacing the
   URL with the one you copied in Part 1, step 4:
   ```
   VITE_WORKER_URL=https://muffin-worker.<your-subdomain>.workers.dev
   ```

3. Install dependencies (skip if you already ran this while developing):
   ```
   npm install
   ```

4. Build the production site:
   ```
   npm run build
   ```
   This creates a `dist` folder with the static site.

5. Deploy it to Cloudflare Pages:
   ```
   npx wrangler pages deploy dist --project-name=muffin
   ```
   The first time, it may ask to create the project — say yes. When it finishes, it prints your
   live URL, like `https://muffin.pages.dev`.

6. **Lock the backend down to your real site.** Open `worker/wrangler.toml`, and change:
   ```toml
   [vars]
   ALLOWED_ORIGIN = "http://localhost:5173"
   ```
   to your real Pages URL, e.g.:
   ```toml
   [vars]
   ALLOWED_ORIGIN = "https://muffin.pages.dev"
   ```
   Then redeploy the worker so the change takes effect:
   ```
   cd ../worker
   npx wrangler deploy
   ```

Done — share the `https://muffin.pages.dev` link with the club.

**To ship updates later:** repeat steps 4–5 (`npm run build` then `wrangler pages deploy dist
--project-name=muffin`) from the `frontend` folder.

### Option B — GitHub Pages

1. Push this project to a new GitHub repository (skip if it's already on GitHub).

2. In `frontend/vite.config.js`, add a `base` matching your repo name (this makes asset paths work
   under `https://<username>.github.io/<repo-name>/`):
   ```js
   export default defineConfig({
     plugins: [react(), tailwindcss()],
     base: '/<repo-name>/',
   })
   ```

3. Create `frontend/.env.production` with your worker URL (same as Option A, step 2):
   ```
   VITE_WORKER_URL=https://muffin-worker.<your-subdomain>.workers.dev
   ```

4. Install a small helper package that publishes the `dist` folder to GitHub Pages:
   ```
   cd frontend
   npm install -D gh-pages
   ```

5. Add these two lines inside `"scripts"` in `frontend/package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

6. Run the deploy:
   ```
   npm run deploy
   ```
   This pushes `dist` to a `gh-pages` branch.

7. On GitHub: go to your repo → **Settings → Pages** → under "Build and deployment", set
   **Source: Deploy from a branch**, branch: `gh-pages`, folder: `/ (root)`. Save. GitHub will give
   you a URL like `https://<username>.github.io/<repo-name>/`.

8. **Lock the backend down**: same as Option A step 6, but set `ALLOWED_ORIGIN` to your GitHub
   Pages URL, then `npx wrangler deploy` again from the `worker` folder.

**To ship updates later:** run `npm run deploy` again from `frontend`.

---

## Local development (before you deploy, or to keep improving Muffin later)

Run these in two separate terminals, both from the project root:

```
cd worker
cp .dev.vars.example .dev.vars   # then edit .dev.vars with a real GROQ_API_KEY
npm run dev
```

```
cd frontend
npm run dev
```

Visit http://localhost:5173 — it talks to the worker at http://127.0.0.1:8787 automatically.

## Notes

- Chat history is stored only in each browser's `localStorage` — clearing browser data or using a
  different device/browser starts fresh.
- The site and worker are open to anyone with the link — there's no login gate. Anyone who
  discovers the URLs can use your Groq key's quota, so keep an eye on usage if you make the repo
  public.
