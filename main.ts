/**
 * Script for fetching Deno (https://deno.com) related RSS feeds and
 * posting them in a Telegram channel. Join https://t.me/deno_news for demo.
 * IV Rules are in the rules/ directory.
 *
 * Licensed under MIT | Copyright (c) 2022-2024 Dunkan
 * GitHub Repository: https://github.com/dcdunkan/deno-bot
 */

import { parseFeed, type FeedEntry } from "https://deno.land/x/rss@1.1.1/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.31.3/mod.ts";

// To avoid reposting from the beginning in case of removal of the
// last stored entry, we store last X feed entry IDs and iterate
// through the all entries until we hit the first "already sent" entry.
const LAST_X_TO_STORE = 12;
const ENV = env("BOT_TOKEN", "CHANNEL");
const kv = await Deno.openKv();
const bot = new Bot(ENV.BOT_TOKEN);
const CHANNEL = Number(ENV.CHANNEL);
if (isNaN(CHANNEL)) throw new Error("CHANNEL should be a chat (channel) ID");

// See the iv-rules/ directory for the Instant-View sources.
const RHASHES: Record<string, string> = {
  "deno.news": "b5ba1c523db473", // https://deno.news/archive/...
  "deno.com": "28aee3eda1037a", // https://deno.com/blog/...
  "devblogs.microsoft.com": "24952bb2da22c6", // https://devblogs.microsoft.com/...
  "v8.dev": "8320f1ac30d205", // https://v8.dev/{blog/,docs/}...
  "bun.sh": "631ee27991e51a", // https://bun.sh/blog/...
};
const SOURCES = {
  blog: "https://deno.com/feed",
  news: "https://buttondown.email/denonews/rss",
  typescript: "https://devblogs.microsoft.com/typescript/feed/",
  v8_blog: "https://v8.dev/blog.atom",
  deploy_changelog: "https://deno.com/deploy/feed",
  release: "denoland/deno",
  std_release: "denoland/deno_std",
  bun_blog: "https://bun.sh/rss.xml",
} as const;
const ROUTES = Object.keys(SOURCES) as Feed[];

type Feed = keyof typeof SOURCES;
type NewsHandler = () => Promise<{ message: string; previewUrl?: string }[]>;
type FeedEntryProcessor = (entry: FeedEntry) => { title: string; url: string };
type SendMessageOptions = Parameters<typeof bot.api.sendMessage>[2];
interface Release {
  name: string;
  id: number;
  html_url: string;
}

const newsHandlers: Record<Feed, NewsHandler> = {
  blog: getFeedHandler("blog"),
  news: getFeedHandler("news", (entry) => ({
    title: entry.title?.value ?? "",
    url: (entry.links?.[0].href ?? entry.id).replace("buttondown.email/denonews", "deno.news"),
  })),
  typescript: getFeedHandler("typescript"),
  v8_blog: getFeedHandler("v8_blog"),
  deploy_changelog: getFeedHandler("deploy_changelog"),
  release: getReleaseHandler("release", "Deno"),
  std_release: getReleaseHandler("std_release", "std"),
  bun_blog: getFeedHandler("bun_blog"),
};

async function getLatestFeedEntries(page: Feed): Promise<FeedEntry[]> {
  const lastChecked = await kv.get<string[]>(["denonews", page]);
  const response = await fetch(SOURCES[page]);
  const textFeed = await response.text();
  const feed = await parseFeed(textFeed);
  if (feed.entries.length === 0) return [];
  if (lastChecked.value == null) {
    // freshly added feed -> store the latest entry.
    const entries = feed.entries
      .filter((entry) => entry.id != null)
      .slice(0, LAST_X_TO_STORE);
    const ids = entries.map((entry) => entry.id);
    await kv.set(["denonews", page], ids);
    return [entries[0]]; // send latest entry -> everything works fine.
  }
  const entries: FeedEntry[] = [];
  for (const entry of feed.entries) {
    if (entry.id == null) continue; // this shouldn't be happening
    if (lastChecked.value.includes(entry.id)) break;
    entries.unshift(entry); // FIFO
  }
  if (entries.length > 0) {
    const lastFew = feed.entries
      .filter((entry) => entry.id != null)
      .slice(0, LAST_X_TO_STORE)
      .map((entry) => entry.id);
    await kv.set(["denonews", page], lastFew);
  }
  return entries;
}

function getFeedHandler(
  feed: Feed,
  entryProcessor: FeedEntryProcessor = (entry) => ({
    title: entry.title?.value ?? "",
    url: entry.links[0].href ?? entry.id,
  }),
): NewsHandler {
  return async () => {
    const entries = await getLatestFeedEntries(feed);
    return entries.map((entry) => {
      const { title, url } = entryProcessor(entry);
      return { message: `<b>${esc(title)}</b>\n\n${esc(url)}`, previewUrl: iv(url) };
    });
  };
}

async function getLatestRelease(repo: Feed) {
  const lastSent = await kv.get<number>(["denonews", repo]);
  const url = `https://api.github.com/repos/${SOURCES[repo]}/releases/latest`;
  const response = await fetch(url);
  if (!response.ok) return;
  const release = await response.json() as Release;
  if (lastSent.value != null && release.id === lastSent.value) return;
  await kv.set(["denonews", repo], release.id);
  return release;
}

function getReleaseHandler(repo: Feed, title: string): NewsHandler {
  return async () => {
    const release = await getLatestRelease(repo);
    if (release == null) return [];
    return [{ message: `<b>${title} ${esc(release.name)}</b>\n\n${esc(release.html_url)}` }];
  };
}

Deno.cron("Fetch feeds and post news", { minute: { every: 1 } }, async () => {
  const feed = selectNewsHandler();
  const messages = await newsHandlers[feed]();
  for (const { message, previewUrl } of messages) {
    const sent = feed === "release" || feed === "std_release"
      ? await post(message, { link_preview_options: { is_disabled: true } })
      : await post(message, previewUrl ? { link_preview_options: { url: previewUrl, prefer_small_media: true } } : {});
    if (feed !== "release") continue;
    const lastPinned = await kv.get<string>(["denonews", "release_pin"]);
    if (lastPinned.value == null) continue;
    try { // Maybe the message was unpinned by administrators.
      await bot.api.unpinChatMessage(CHANNEL, Number(lastPinned.value));
      await bot.api.pinChatMessage(CHANNEL, sent.message_id, { disable_notification: true });
      await kv.set(["denonews", "release_pin"], sent.message_id);
    } catch (error) {
      console.error(error);
    }
  }
  console.log({ feed, sent: messages.length });
});

function selectNewsHandler(): Feed {
  return ROUTES[new Date().getMinutes() % ROUTES.length];
}

function post(text: string, options?: SendMessageOptions) {
  return bot.api.sendMessage(CHANNEL, text, { parse_mode: "HTML", ...options });
}

function iv(url: string) {
  const rhash = RHASHES[new URL(url).hostname];
  if (rhash != null) return `https://t.me/iv?rhash=${rhash}&url=${url}`;
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function env<T extends string>(...keys: T[]): { [key in T]: string } {
  return keys.reduce(
    (v, k) => ({ ...v, [k]: Deno.env.get(k) as string }),
    {} as { [key in T]: string },
  );
}
