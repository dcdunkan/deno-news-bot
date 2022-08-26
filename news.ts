// Checks for news that was published within the last 10 minutes
// in https://deno.news, and posts the URL with Instant View.
// CRON JOB required. /news endpoint must be called every 10 minutes
// for the best results.

import { esc, isNewPost, iv, post } from "./helpers.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.6/mod.ts";

const NEWS_RSS_FEED = "https://buttondown.email/denonews/rss";

export async function news() {
  const response = await fetch(NEWS_RSS_FEED);
  if (!response.ok) return;
  const content = await response.text();
  const feed = await parseFeed(content);
  const entry = feed.entries[0];

  if (!entry || !entry.published) return;
  if (!isNewPost(entry.published, 10)) return;

  const title = entry.title?.value!;
  const url = (entry.links[0].href ?? entry.id).replace(
    "https://buttondown.email/denonews/",
    "https://deno.news/",
  );

  await post(
    `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`,
    { parse_mode: "HTML" },
  );
}
