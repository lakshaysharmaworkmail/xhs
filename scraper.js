// =============================================
// XHS SCRAPER - Node.js core (ported from Apps Script v6)
// =============================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- HTTP fetch helpers ----------

async function fetchDirect(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://www.xiaohongshu.com/",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

async function fetchProxy(targetUrl, proxyBase, isJson) {
  const proxyUrl = proxyBase + encodeURIComponent(targetUrl);
  const res = await fetch(proxyUrl, {
    redirect: "follow",
    headers: { Accept: "application/json, text/html, */*" },
  });
  if (!res.ok) throw new Error("Proxy HTTP " + res.status);
  let body = await res.text();
  if (isJson) {
    try {
      const j = JSON.parse(body);
      body = j.contents || j.body || body;
    } catch (e) {}
  }
  if (!body || body.length < 800) throw new Error("Too short: " + body.length);
  return body;
}

async function smartFetch(targetUrl) {
  const methods = [
    () => fetchDirect(targetUrl),
    () => fetchProxy(targetUrl, "https://api.allorigins.win/get?url=", true),
    () => fetchProxy(targetUrl, "https://api.allorigins.win/raw?url=", false),
    () => fetchProxy(targetUrl, "https://corsproxy.io/?", false),
    () => fetchProxy(targetUrl, "https://api.codetabs.com/v1/proxy?quest=", false),
  ];
  let lastErr = "";
  for (const method of methods) {
    try {
      const html = await method();
      if (html && html.length > 800) return html;
    } catch (e) {
      lastErr = e.message;
    }
    await sleep(100);
  }
  throw new Error("Sab methods fail | " + lastErr);
}

// ---------- small string helpers ----------

function rx(txt, regex) {
  try {
    const m = String(txt || "").match(regex);
    return m && m[1] ? m[1] : "";
  } catch (e) {
    return "";
  }
}

function cln(t) {
  if (!t) return "";
  return String(t)
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => {
      try {
        return String.fromCharCode(parseInt(h, 16));
      } catch (e) {
        return "";
      }
    })
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fmt(n) {
  if (n === undefined || n === null || n === "") return "";
  return String(n);
}

function wan(raw) {
  if (!raw) return "";
  const s = String(raw).trim().replace(/\+$/, "").replace(/,/g, "").replace(/\s/g, "");
  const wm = s.match(/^([\d.]+)万$/);
  if (wm) return String(Math.round(parseFloat(wm[1]) * 10000));
  const km = s.match(/^([\d.]+)[kK]$/);
  if (km) return String(Math.round(parseFloat(km[1]) * 1000));
  const n = Number(s);
  return isNaN(n) ? s : String(Math.round(n));
}

function tsDate(ts) {
  try {
    const ms = ts > 1e12 ? ts : ts * 1000;
    const d = new Date(ms);
    // format similar to Asia/Shanghai yyyy-MM-dd HH:mm:ss
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  } catch (e) {
    return "";
  }
}

function hms(sec) {
  sec = Number(sec);
  if (isNaN(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function blankRow(status) {
  return ["", "", "", "", "", "", "", "", "", "", "", status || ""];
}

// ---------- __INITIAL_STATE__ parsing ----------

function parseState(html) {
  const marker = html.indexOf("__INITIAL_STATE__");
  if (marker === -1) return null;
  const start = html.indexOf("{", marker);
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  const limit = Math.min(start + 900000, html.length);
  for (let i = start; i < limit; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(html.substring(start, end).replace(/:\s*undefined\b/g, ":null"));
  } catch (e) {
    return null;
  }
}

// ---------- scrapers ----------

function scrapeProfile(html, url, state) {
  const profileId = rx(url, /profile\/([a-zA-Z0-9]{8,})/i);
  let name = "";
  let likes = "";
  if (state && state.user && state.user.userPageData) {
    try {
      const bi = state.user.userPageData.basicInfo || {};
      name = bi.nickname || bi.nickName || bi.name || "";
      const arr = state.user.userPageData.interactions;
      if (Array.isArray(arr)) {
        arr.forEach((it) => {
          const t = (it.type || "").toLowerCase();
          const raw = String(it.count || it.i18nCount || "");
          if (t === "interaction" || t === "liked" || t === "likes") likes = wan(raw);
        });
      }
    } catch (e) {}
  }
  if (!name) name = cln(rx(html, /"nickname"\s*:\s*"((?:[^"\\]|\\.)*)"/));
  if (!likes) {
    const txt2 = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    likes = wan(
      rx(txt2, /([\d.]+\s*万\+?)\s*获赞与收藏/) ||
        rx(txt2, /([\d.]+\s*万\+?)\s*获赞/) ||
        rx(txt2, /([\d.]+)\s*\+?\s*获赞/)
    );
  }
  if (!name) name = profileId;
  return [url, "PROFILE", url, profileId, name, likes, "", "", "", "", "", "SUCCESS"];
}

function scrapePost(html, url, state) {
  const postId = rx(url, /explore\/([0-9a-fA-F]{16,})/i);
  let name = "",
    profileId = "",
    profileUrl = "";
  let likes = "",
    comments = "",
    favorites = "";
  let title = "",
    desc = "",
    date = "",
    duration = "";

  if (state) {
    try {
      const ndm = (state.note && state.note.noteDetailMap) || {};
      const keys = Object.keys(ndm);
      const entry = ndm[postId] || ndm[(postId || "").toUpperCase()] || (keys.length ? ndm[keys[0]] : null);
      const note = entry && (entry.note || entry);
      if (note) {
        title = note.title || "";
        desc = note.desc || note.description || "";
        if (note.user) {
          name = note.user.nickname || note.user.nickName || "";
          profileId = note.user.userId || note.user.id || "";
        }
        const ii = note.interactInfo || {};
        likes = fmt(ii.likedCount || ii.likeCount || "");
        comments = fmt(ii.commentCount || "");
        favorites = fmt(ii.collectedCount || "");
        const ts = note.time || note.createTime || note.publishTime || 0;
        if (ts) date = tsDate(ts);
        const vi = note.video || note.videoInfo;
        if (vi) {
          const d = vi.duration || (vi.capa && vi.capa.duration) || 0;
          if (d) duration = hms(Math.round(Number(d)));
        }
      }
    } catch (e) {}
  }

  if (!title) title = cln(rx(html, /"title":"((?:[^"\\]|\\.)*)"/));
  if (!desc) desc = cln(rx(html, /"desc":"((?:[^"\\]|\\.)*)"/));
  if (!name) name = cln(rx(html, /"nickname":"((?:[^"\\]|\\.)*)"/));
  if (!profileId) profileId = rx(html, /"userId":"([^"]+)"/) || rx(html, /"authorId":"([^"]+)"/);
  if (!likes) likes = fmt(rx(html, /"likedCount":"?(\d+)"?/));
  if (!comments) comments = fmt(rx(html, /"commentCount":(\d+)/));
  if (!favorites) favorites = fmt(rx(html, /"collectedCount":(\d+)/));
  if (!date && postId && postId.length >= 8) {
    try {
      const ts2 = parseInt(postId.substring(0, 8), 16);
      if (ts2 > 1388534400 && ts2 < 2051218800) date = tsDate(ts2);
    } catch (e2) {}
  }
  if (profileId) profileUrl = "https://www.xiaohongshu.com/user/profile/" + profileId;
  const fullTitle = title && desc && title !== desc ? title + " | " + desc : title || desc;

  return [url, "POST", profileUrl, profileId, name, likes, comments, favorites, fullTitle, date, duration, "SUCCESS"];
}

function scrapeRouter(html, url) {
  const isPost = url.indexOf("/explore/") > -1 || url.indexOf("/discovery/item/") > -1;
  const isProfile = url.indexOf("/user/profile/") > -1;
  const state = parseState(html);
  if (isPost) return scrapePost(html, url, state);
  if (isProfile) return scrapeProfile(html, url, state);
  return blankRow("UNKNOWN URL");
}

const HEADERS = [
  "URL",
  "Type",
  "Profile URL",
  "Username (Profile ID)",
  "Display Name",
  "Likes+Favorites",
  "Comments",
  "Favorites",
  "Post Title / Description",
  "Post Date",
  "Duration",
  "Status",
];

async function scrapeUrl(url) {
  try {
    const html = await smartFetch(url);
    return scrapeRouter(html, url);
  } catch (e) {
    const r = blankRow(String(e.message || e).substring(0, 120));
    r[0] = url;
    return r;
  }
}

function rowToObject(row) {
  return {
    url: row[0],
    type: row[1],
    profileUrl: row[2],
    profileId: row[3],
    displayName: row[4],
    likesFavorites: row[5],
    comments: row[6],
    favorites: row[7],
    title: row[8],
    date: row[9],
    duration: row[10],
    status: row[11],
  };
}

module.exports = { scrapeUrl, rowToObject, HEADERS, smartFetch, scrapeRouter, parseState };
