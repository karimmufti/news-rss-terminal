// server.js
const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fetch = require('node-fetch');

const app = express();
app.use(cors());               // allow your browser to call the API
app.use(express.json());

const FEED_URL = 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml';
const parser = new Parser({ timeout: 10000 });

// optional validators for conditional requests
let etag = null;
let lastModified = null;

// fetch + parse like before
async function fetchFeed(url) {
  const headers = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;

  const res = await fetch(url, { headers });

  if (res.status === 304) {
    // nothing changed — in a simple demo we’ll just refetch without validators
    // (NYT doesn’t always honor validators consistently)
    // You can return a cached copy if you implement caching.
  }

  etag = res.headers.get('etag') || etag;
  lastModified = res.headers.get('last-modified') || lastModified;

  const xml = await res.text();
  const feed = await parser.parseString(xml);
  return feed.items || [];
}

// helper to normalize + sort newest → oldest
function normalizeAndSort(items) {
  return (items || [])
    .map(it => ({
      title: it.title || '(no title)',
      link: it.link || '',
      author: it.creator || it['dc:creator'] || null,
      publishedAt: new Date(it.isoDate || it.pubDate || 0).toISOString(), // ISO string for JSON
      summary: it.contentSnippet || '',
      // you can include more fields later (content, categories, etc.)
    }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

// API: GET /api/feed → JSON list of latest items
app.get('/api/feed', async (req, res) => {
  try {
    const items = await fetchFeed(FEED_URL);
    const sorted = normalizeAndSort(items);
    res.json({ items: sorted.slice(0, 50) }); // cap to 50 for now
  } catch (e) {
    console.error('API error:', e);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// serve static files from /public (we’ll add index.html next)
app.use(express.static('public'));

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on http://localhost:${PORT}`);
});
