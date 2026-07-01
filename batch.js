const { scrapeUrl, rowToObject } = require("../lib/scraper");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Use POST with { urls: [...] }" });
    return;
  }

  try {
    const body = req.body || {};
    let urls = body.urls;

    if (!Array.isArray(urls)) {
      res.status(400).json({ success: false, error: "urls must be an array" });
      return;
    }

    // Safety cap so a single request doesn't run forever on Vercel's function timeout
    urls = urls.slice(0, 25);

    const results = [];
    for (const url of urls) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) continue;
      const row = await scrapeUrl(cleanUrl);
      results.push(rowToObject(row));
      await sleep(200);
    }

    res.status(200).json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};
