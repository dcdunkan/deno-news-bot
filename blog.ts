// Cron-job for this blog post updater should be ran every 10 minutes.
// It only posts if there was a blog post within the last 10 minutes.

import { esc, post } from "./bot.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.6/mod.ts";
import { difference } from "https://deno.land/std@0.153.0/datetime/mod.ts";

const BLOG_URL = "https://deno.com/feed";

export async function blog() {
  const response = await fetch(BLOG_URL);
  if (response.ok) {
    const content = await response.text();
    const feed = await parseFeed(content);
    const entry = feed.entries[0];
    if (entry && entry.published) {
      const diff = difference(new Date(entry.published), new Date());
      if (diff.milliseconds! <= 60 * 10 * 1000) {
        const title = entry.title?.value!;
        const url = entry.links[0].href ?? entry.id;
        await post(`<b>${esc(title)}</b>\n\n${esc(url)}`, {
          parse_mode: "HTML",
        });
      }
    }
  }
  return new Response();
}
