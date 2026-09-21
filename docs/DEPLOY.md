# Deploying NameLens

Frontend on GitHub Pages, API + PostgreSQL on Render (free tiers). Free instances sleep when idle, so the first request after a pause can take about a minute; Render's free PostgreSQL is time-limited, check their current terms.

1. **API:** on render.com choose New → Blueprint, select this repository. `render.yaml` creates the API (built from the root `Dockerfile`) and a database. Note the service URL, e.g. `https://namelens-api.onrender.com`. Check `<url>/api/v1/health` returns `"status":"ok"`.
2. **Pages:** repository Settings → Pages → Source: **GitHub Actions**. Settings → Secrets and variables → Actions → Variables → add `API_BASE` = the API URL (no trailing slash).
3. Push to `main` (or run the *Deploy web to GitHub Pages* workflow). The site appears at https://leumaslarotrebor.github.io/namelens/
4. **Extension:** `cd extension && API_BASE=<api url> WEB_BASE=https://leumaslarotrebor.github.io/namelens npm run build`, then load `extension/dist` unpacked.

If the API URL differs from the one in `render.yaml`, or the Pages origin changes, update `CORS_ORIGINS` on the API service.
