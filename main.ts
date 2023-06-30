/**
 * Script for fetching Deno (https://deno.land) related RSS feeds and
 * posting them in a Telegram channel. Requires a cron-job calling the
 * main end point every 1 minute. The feed to be fetched is automatically
 * selected one-by-one. Join https://t.me/deno_news for demo.
 * IV Rules are in the rules/ directory. 'secret' header should be set
 * when calling the end point (if SECRET is set in environmental variables).
 *
 * Licensed under MIT | Copyright (c) 2022-Present Dunkan
 * GitHub Repository: https://github.com/dcdunkan/deno-bot
 */

import { load } from "https://deno.land/std@0.192.0/dotenv/mod.ts";
import { serve } from "https://deno.land/std@0.192.0/http/mod.ts";
import { parseFeed } from "https://deno.land/x/rss@0.6.0/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.17.1/mod.ts";

// To avoid reposting from the beginning in case of removal of the
// last stored entry, we store last X feed entry IDs and iterate
// through the all entries until we hit the first "already sent" entry.
const LAST_X_TO_STORE = 12;

await load({ export: true });
const env = Deno.env.toObject() as {
  BOT_TOKEN: string;
  SECRET?: string;
};

const kv = await Deno.openKv();

const bot = new Bot(env.BOT_TOKEN);
const CHANNEL = Number(Deno.env.get("CHANNEL"));
if (isNaN(CHANNEL)) throw new Error("CHANNEL should be a chat (channel) ID");
const ZWSP = "\u200b"; // zero-width space character for IV.

// See the iv-rules/ directory for the Instant-View sources.
const RHASHES: Record<string, string> = {
  "deno.news": "b5ba1c523db473", // https://deno.news/archive/...
  "deno.com": "28aee3eda1037a", // https://deno.com/blog/...
  "devblogs.microsoft.com": "24952bb2da22c6", // https://devblogs.microsoft.com/...
};

const FEEDS = {
  blog: "https://deno.com/feed",
  news: "https://buttondown.email/denonews/rss",
  release: "denoland/deno",
  std_release: "denoland/deno_std",
  typescript: "https://devblogs.microsoft.com/typescript/feed/",
} as const;

type Feed = keyof typeof FEEDS;

const handlers: Record<Feed, () => Promise<string[]>> = {
  blog: async () => {
    const entries = await getLatestEntries("blog");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  news: async () => {
    const entries = await getLatestEntries("news");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = (entry.links[0].href ?? entry.id)
        .replace("buttondown.email/denonews", "deno.news");
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  release: async () => {
    const release = await getLatestRelease("release");
    if (release == null) return [];
    return [`<b>Deno ${esc(release.name)}</b>\n\n${esc(release.html_url)}`];
  },
  std_release: async () => {
    const release = await getLatestRelease("std_release");
    if (release == null) return [];
    return [`<b>std ${esc(release.name)}</b>\n\n${esc(release.html_url)}`];
  },
  typescript: async () => {
    const entries = await getLatestEntries("typescript");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
};

const ROUTES = Object.keys(FEEDS) as Feed[];

async function getLatestEntries(page: Feed) {
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

interface Release {
  name: string;
  id: number;
  html_url: string;
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

async function handle(req: Request) {
  const route = selectRoute();
  const routeHandler = handlers[route];
  const secretHeader = req.headers.get("secret");
  if (env.SECRET != null && secretHeader !== env.SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const messages = await routeHandler();
  for (const message of messages) {
    const sent = route === "release" || route === "std_release"
      ? await post(message, { disable_web_page_preview: true })
      : await post(message);
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

type SendMessageOptions = Parameters<typeof bot.api.sendMessage>[2];

function post(text: string, options?: SendMessageOptions) {
  return bot.api.sendMessage(CHANNEL, text, { parse_mode: "HTML", ...options });
}

function iv(url: string) {
  const rhash = RHASHES[new URL(url).hostname];
  return `<a href="https://t.me/iv?rhash=${rhash}&url=${url}">${ZWSP}</a>`;
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

serve(handle, {
  onError: (err) => {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  },
});
