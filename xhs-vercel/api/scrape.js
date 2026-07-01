const { scrapeUrl, rowToObject } = require("../lib/scraper");

module.exports = async function handler(req, res) {
  // Allow calling from anywhere (Excel Online, Google Sheets, browser, etc.)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    let url = "";

    if (req.method === "GET") {
      url = req.query.url || "";
    } else if (req.method === "POST") {
      const body = req.body || {};
      url = body.url || body.xhsUrl || "";
    } else {
      res.status(405).json({ success: false, error: "Method not allowed" });
      return;
    }

    url = String(url || "").trim();

    if (!url) {
      res.status(400).json({ success: false, error: "URL required" });
      return;
    }

    const row = await scrapeUrl(url);
    const data = rowToObject(row);

    res.status(200).json({
      success: data.status === "SUCCESS",
      data,
      debug: { originalUrl: url },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
};
