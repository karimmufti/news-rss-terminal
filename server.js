// server.js
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- FEEDS: start with a few, add more later ----------
const FEEDS = [
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://www.theguardian.com/world/rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
];

// serve the static frontend
app.use(express.static('public'));

// one parser instance is fine
const parser = new Parser({ timeout: 10000 });

// tiny helper: get a host from any URL
function host(u) {
  try { return new URL(u).host.replace(/^www\./, ''); }
  catch { return ''; }
}

// normalize items from any feed into a common shape
function normalizeItems(items, sourceHost) {
  return (items || []).map((it) => {
    const link = it.link || it.guid || '';
    const publishedAt = new Date(it.isoDate || it.pubDate || 0);
    return {
      id: (it.guid || link || it.title || '').toLowerCase(), // for de-dupe
      title: it.title || '(no title)',
      link,
      source: sourceHost,                      // e.g., nytimes.com
      summary: it.contentSnippet || '',
      publishedAt: isNaN(publishedAt) ? new Date(0) : publishedAt,
    };
  });
}

// fetch & parse one feed URL → normalized items
async function fetchOne(url) {
  // basic fetch; we could add headers/user-agent if a site requires it
  const res = await fetch(url);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  const src = host(url) || 'feed';
  return normalizeItems(feed.items, src);
}

// GET /api/feed?limit=50
// merge all feeds, de-dupe by id, sort newest→oldest
app.get('/api/feed', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);

  try {
    // 1) fetch all feeds concurrently
    const arrays = await Promise.all(FEEDS.map(fetchOne));

    // 2) merge
    const merged = arrays.flat();

    // 3) de-dupe: prefer the newer duplicate
    const dedup = new Map();
    for (const it of merged) {
      const prev = dedup.get(it.id);
      if (!prev || it.publishedAt > prev.publishedAt) dedup.set(it.id, it);
    }

    // 4) sort newest first and trim to limit
    const sorted = [...dedup.values()]
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit)
      .map((it) => ({
        title: it.title,
        link: it.link,
        author: null,
        publishedAt: it.publishedAt.toISOString(),
        summary: it.summary,
        source: it.source, // <-- frontend can show this directly
      }));

    res.json({ items: sorted });
  } catch (e) {
    console.error('API /api/feed error:', e);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on http://localhost:${PORT}`);
});
