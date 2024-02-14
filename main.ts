/**
 * Script for fetching Deno (https://deno.land) related RSS feeds and
 * posting them in a Telegram channel. Requires a cron-job calling the
 * main end point every 1 minute. The feed to be fetched is automatically
 * selected one-by-one. Join https://t.me/deno_news for demo.
 * IV Rules are in the rules/ directory. 'secret' header should be set
 * when calling the end point (if SECRET is set in environmental variables).
 *
 * Licensed under MIT | Copyright (c) 2022-2023 Dunkan
 * GitHub Repository: https://github.com/dcdunkan/deno-bot
 */

import { parseFeed } from "https://deno.land/x/rss@1.0.0/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.20.3/mod.ts";
import { FeedEntry } from "https://deno.land/x/rss@1.0.0/src/types/feed.ts";

// To avoid reposting from the beginning in case of removal of the
// last stored entry, we store last X feed entry IDs and iterate
// through the all entries until we hit the first "already sent" entry.
const LAST_X_TO_STORE = 12;
const ENV = env("BOT_TOKEN", "CHANNEL", "SECRET");

const kv = await Deno.openKv();
const bot = new Bot(ENV.BOT_TOKEN);
const CHANNEL = Number(ENV.CHANNEL);
if (isNaN(CHANNEL)) throw new Error("CHANNEL should be a chat (channel) ID");

// See the iv-rules/ directory for the Instant-View sources.
const RHASHES: Record<string, string> = {
  "deno.news": "b5ba1c523db473", // https://deno.news/archive/...
  "deno.com": "28aee3eda1037a", // https://deno.com/blog/...
  "devblogs.microsoft.com": "24952bb2da22c6", // https://devblogs.microsoft.com/...
};
const FEEDS = {
  blog: "https://deno.com/feed",
  news: "https://buttondown.email/denonews/rss",
  typescript: "https://devblogs.microsoft.com/typescript/feed/",
  v8_blog: "https://v8.dev/blog.atom",
  deploy_changelog: "https://deno.com/deploy/feed",
  release: "denoland/deno",
  std_release: "denoland/deno_std",
} as const;
const ROUTES = Object.keys(FEEDS) as Feed[];

type Feed = keyof typeof FEEDS;
type FeedHandler = () => Promise<{ message: string; previewUrl?: string }[]>;
type FeedEntryProcessor = (entry: FeedEntry) => { title: string; url: string };
type SendMessageOptions = Parameters<typeof bot.api.sendMessage>[2];
interface Release {
  name: string;
  id: number;
  html_url: string;
}

const handlers: Record<Feed, FeedHandler> = {
  blog: getFeedHandler("blog"),
  news: getFeedHandler("news", (entry) => ({
    title: entry.title?.value ?? "",
    url: (entry.links[0].href ?? entry.id).replace("buttondown.email/denonews", "deno.news"),
  })),
  typescript: getFeedHandler("typescript"),
  v8_blog: getFeedHandler("v8_blog"),
  deploy_changelog: getFeedHandler("deploy_changelog"),
  release: getReleaseHandler("release", "Deno"),
  std_release: getReleaseHandler("std_release", "std"),
};

async function getLatestFeedEntries(page: Feed) {
  const lastChecked = await kv.get<string[]>(["denonews", page]);
  const response = await fetch(FEEDS[page]);
  const textFeed = await response.text();
  const feed = await parseFeed(textFeed);
  if (feed.entries.length === 0) return [];
  if (lastChecked.value == null) {
    // freshly added feed -> store the latest entry.
    const entries = feed.entries
      .filter((entry) => entry.id != null)
      .slice(0, LAST_X_TO_STORE)
      .map((entry) => entry.id);
    await kv.set(["denonews", page], entries);
    return [];
  }
  const entries: typeof feed.entries = [];
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

function getDefaultEntryProcessor(): FeedEntryProcessor {
  return ((entry) => ({ title: entry.title?.value ?? "", url: entry.links[0].href ?? entry.id }));
}

function getFeedHandler(feed: Feed, entryProcessor: FeedEntryProcessor = getDefaultEntryProcessor()): FeedHandler {
  return async () => {
    const entries = await getLatestFeedEntries(feed);
    return entries.map((entry) => {
      const { title, url } = entryProcessor(entry);
      return { message: `<b>${esc(title)}</b>\n\n${esc(url)}`, url: iv(url) };
    });
  };
}

async function getLatestRelease(repo: Feed) {
  const lastSent = await kv.get<number>(["denonews", repo]);
  const url = `https://api.github.com/repos/${FEEDS[repo]}/releases/latest`;
  const response = await fetch(url);
  if (!response.ok) return;
  const release = await response.json() as Release;
  if (lastSent.value != null && release.id === lastSent.value) return;
  await kv.set(["denonews", repo], release.id);
  return release;
}

function getReleaseHandler(repo: Feed, title: string): FeedHandler {
  return async () => {
    const release = await getLatestRelease(repo);
    if (release == null) return [];
    return [{ message: `<b>${title} ${esc(release.name)}</b>\n\n${esc(release.html_url)}` }];
  };
}

async function handle(req: Request) {
  const route = selectRoute();
  const routeHandler = handlers[route];
  const secretHeader = req.headers.get("secret");
  if (ENV.SECRET != null && secretHeader !== ENV.SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const messages = await routeHandler();
  for (const { message, previewUrl } of messages) {
    const sent = route === "release" || route === "std_release"
      ? await post(message, { link_preview_options: { is_disabled: true } })
      : await post(message, previewUrl ? { link_preview_options: { url: previewUrl, prefer_small_media: true } } : {});
    if (route === "release") {
      const lastPinned = await kv.get<string>(["denonews", "release_pin"]);
      if (lastPinned.value != null) {
        try { // Maybe the message was unpinned by administrators.
          await bot.api.unpinChatMessage(CHANNEL, Number(lastPinned.value));
        } catch (error) {
          console.error(error);
        }
      }
      await bot.api.pinChatMessage(CHANNEL, sent.message_id);
      await kv.set(["denonews", "release_pin"], sent.message_id);
    }
  }
  return Response.json({ ok: true, checked: route, sent: messages.length });
}

function selectRoute(): Feed {
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

Deno.serve({
  onError: (err) => {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  },
}, handle);
