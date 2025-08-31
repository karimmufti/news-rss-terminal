//loading Libraries alr installed:
const Parser = require('rss-parser');
const fetch = require('node-fetch');
const dayjs = require('dayjs');
const chalk = require('chalk');

//picking rss feed URL 
//NYT rss feed url = 
const FEED_URL = "http://feeds.nytimes.com/nyt/rss/HomePage"

//timeout for parsing not network fetch 
const parser = new Parser({timeout: 10000})

//function that fetches RSS and XML, returns items
//shouldnt use etag / lastmodified for cheaper requests, but for now since its v1
async function fetchFeed(url, etag, lastModified){
    //cond. headers 
    const headers = {};
    if(etag) headers['If-None-Match'] = etag;
    if(lastModified) headers['If-Modified-Since'] = lastModified;

    //make HTTP get request:
    const res = await fetch(url, {headers});

    //if nothing chagned return empty
    if (res.status === 304){
        return {item: [], etag, lastModified};
    }

    // Save new validators for the next call: ????
    const newEtag = res.headers.get('etag') || etag;
    const newLast = res.headers.get('last-modified') || lastModified;

    //get raw xml
    const xml = await res.text(); ///??? why await

    //parse XMl into a JS obj {title, items: [...}
    const feed = await parser.parseString(xml);

    return {items: feed.items || [], etag: newEtag, lastModified: newLast}
}

// 5) Helper to format "how long ago" something was published.
function fmtTime(d) {
    const ts = dayjs(d ?? Date.now());                 // parse date or use now
    const diffMin = Math.max(0, dayjs().diff(ts, 'minute'));
    return diffMin === 0 ? 'now' : `${diffMin}m ago`;  // simple, readable display
  }
  
  // 6) Our "main" function: fetch once, then print the first ~20 items.
  (async () => {
    // Ask the network for the feed, parse it, get an array of items.
    const { items } = await fetchFeed(FEED_URL);
    console.log("DEBUG — first item:", items[0]);
    process.exit(0);
    // Pretty header line with bold text.
    console.log(chalk.bold(`\nNYT — Top Stories (${items.length} items)\n`));
  
    const sorted = items
    .map(it => ({
      ...it,
      publishedAt: new Date(it.isoDate || it.pubDate || 0) // fallback to epoch if missing
    }))
    .sort((a, b) => b.publishedAt - a.publishedAt);
  
  for (const it of sorted.slice(0, 20)) {
    const title = it.title || '(no title)';
    const link  = it.link || '';
    const when  = fmtTime(it.publishedAt);
  
    console.log(`${chalk.cyan('•')} ${chalk.bold(title)}  ${chalk.gray(`(${when})`)}`);
    console.log(chalk.gray(link));
    console.log();
  }
  })();