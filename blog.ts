// Checks for blog posts that was published within the last 10 minutes
// in https://deno.com/blog, and posts the URL with Instant View.
// CRON JOB required. /blog endpoint must be called every 10 minutes
// for the best results.

import { esc, isNewPost, post, iv } from "./helpers.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.6/mod.ts";

const BLOG_RSS_FEED = "https://deno.com/feed";

export async function blog() {
  const response = await fetch(BLOG_RSS_FEED);
  if (!response.ok) return;
  const content = await response.text();
  const feed = await parseFeed(content);
  const entry = feed.entries[0];
  if (!entry || !entry.published) return;
  if (!isNewPost(entry.published, 10)) return;

  const title = entry.title?.value!;
  const url = entry.links[0].href ?? entry.id;
  await post(
    `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`,
    { parse_mode: "HTML" },
  );
}
