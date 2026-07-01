# XHS Scraper — Vercel Deployment

Node.js/Vercel port of the Google Apps Script XHS scraper. Scrapes Xiaohongshu
post and profile pages and returns structured JSON.

## What's inside

```
xhs-vercel/
├── api/
│   ├── scrape.js   # GET/POST single-URL endpoint
│   └── batch.js    # POST multi-URL endpoint (max 25/call)
├── lib/
│   └── scraper.js  # core scraping logic (fetch + parsing)
├── public/
│   └── index.html  # simple test page (paste URLs, see results)
├── package.json
└── vercel.json
```

## Deploy to Vercel (fastest way)

### Option A — Vercel CLI
```bash
npm i -g vercel
cd xhs-vercel
vercel login
vercel --prod
```
Follow the prompts (link/create project). It'll give you a live URL like
`https://your-project.vercel.app`.

### Option B — GitHub + Vercel dashboard
1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com/new, import the repo.
3. Leave all settings default (no framework preset needed) → Deploy.

No environment variables or build step required — this is plain Node.js
serverless functions + a static HTML page.

## Using it

**Web page:** open `https://your-project.vercel.app/` — paste one or more
XHS URLs (one per line) and click Fetch Data.

**API — single URL:**
```bash
curl "https://your-project.vercel.app/api/scrape?url=https://www.xiaohongshu.com/explore/XXXXXXXX"
```
or
```bash
curl -X POST https://your-project.vercel.app/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.xiaohongshu.com/explore/XXXXXXXX"}'
```

**API — batch (up to 25 URLs per call):**
```bash
curl -X POST https://your-project.vercel.app/api/batch \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://www.xiaohongshu.com/explore/AAA","https://www.xiaohongshu.com/user/profile/BBB"]}'
```

Response shape (single):
```json
{
  "success": true,
  "data": {
    "type": "POST",
    "profileUrl": "...",
    "profileId": "...",
    "displayName": "...",
    "likesFavorites": "...",
    "comments": "...",
    "favorites": "...",
    "title": "...",
    "date": "...",
    "duration": "...",
    "status": "SUCCESS"
  }
}
```

## Using it from Excel / Google Sheets

Same as before with the Apps Script Web App — call the deployed
`/api/scrape` URL with the target XHS URL as a parameter, and read the
`data.*` fields from the JSON response. In Excel, this works well via
Power Query (`Data > Get Data > From Web`) pointed at:
```
https://your-project.vercel.app/api/scrape?url=<xhs-url>
```

## Notes / limitations

- Vercel serverless functions have a max execution time (set to 60s here via
  `vercel.json`; free/Hobby plans cap lower — check your plan's limit).
  `batch.js` caps at 25 URLs per call to stay under that.
- The scraper tries a direct fetch first, then falls back through public CORS
  proxies (allorigins, corsproxy.io, codetabs) — same fallback chain as the
  original Apps Script version. These third-party proxies can be flaky or
  rate-limited; if a URL keeps failing, wait and retry.
- This reads Xiaohongshu's public page HTML/embedded JSON — if XHS changes
  their page structure, the regex/JSON paths in `lib/scraper.js` may need
  updating.
