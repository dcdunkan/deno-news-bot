/**
 * Script for fetching Deno (https://deno.land/) related RSS feeds and
 * posting them in a Telegram channel. Requires a cron-job calling the
 * main end point every 1 minute. The feed to be fetched is automatically
 * selected one-by-one. THIS DOES NOT USE A DATABASE. So make sure the
 * cron job is working properly. Join https://t.me/deno_news for demo.
 * IV Rules are in the rules/ directory. 'secret' header should be set
 * when calling the end point (if SECRET is set in environmental variables).
 *
 * Licensed under MIT | Copyright (c) 2022-2023 Dunkan
 * GitHub Repository: https://github.com/dcdunkan/deno-bot
 */

import { load } from "https://deno.land/std@0.177.0/dotenv/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/mod.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.8/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.14.1/mod.ts";

await load({ export: true });
const env = Deno.env.toObject() as {
  BOT_TOKEN: string;
  SECRET: string;
};
const bot = new Bot(env.BOT_TOKEN);
const CHANNEL = Number(Deno.env.get("CHANNEL"));
if (isNaN(CHANNEL)) throw new Error("CHANNEL should be a channel ID");
const ZWSP = "\u200b"; // zero-width space character for IV.
// See rules/ directory for the sources.
const RHASHES: Record<string, string> = {
  "deno.news": "b5ba1c523db473", // https://deno.news/archive/...
  "deno.com": "28aee3eda1037a", // https://deno.com/blog/...
  "devblogs.microsoft.com": "24952bb2da22c6", // https://devblogs.microsoft.com/...
};
const URLS = {
  blog: "https://deno.com/feed",
  news: "https://buttondown.email/denonews/rss",
  status: "https://denostatus.com/history.rss",
  release: "https://api.github.com/repos/denoland/deno/releases/latest",
  typescript: "https://devblogs.microsoft.com/typescript/feed/",
};

const handlers: Record<string, () => Promise<string[]>> = {
  "blog": async () => {
    const entries = await getLatestEntries(URLS.blog);
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  "news": async () => {
    const entries = await getLatestEntries(URLS.news);
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  "status": async () => {
    const entries = await getLatestEntries(URLS.status);
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>\n\n${esc(url)}`;
    });
  },
  "release": async () => {
    const lastChecked = getLastChecked();
    const response = await fetch(URLS.release);
    const release = await response.json();
    const published = new Date(release.published_at);
    if (published < lastChecked) return [];
    return [`<b>${esc(release.name)}</b>\n\n${esc(release.html_url)}`];
  },
  "typescript": async () => {
    const entries = await getLatestEntries(URLS.typescript);
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
};

const ROUTES = Object.keys(handlers);

function getLastChecked() {
  // This is why cron job with 1 minute interval is required.
  return new Date(Date.now() - (ROUTES.length * 60 * 1000));
}

async function getLatestEntries(url: string) {
  const lastChecked = getLastChecked();
  const response = await fetch(url);
  const textFeed = await response.text();
  const feed = await parseFeed(textFeed);
  const entries: typeof feed.entries = [];
  for (const entry of feed.entries) {
    if (!entry.published) continue;
    if (entry.published < lastChecked) break;
    entries.unshift(entry); // FIFO
  }
  return entries;
}

async function handle(req: Request) {
  const route = selectRoute();
  const routeHandler = handlers[route];
  const secretHeader = req.headers.get("secret");
  if (env.SECRET !== undefined && secretHeader !== env.SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const messages = await routeHandler();
  for (const message of messages) {
    const sent = ["status", "release"].includes(route)
      ? await post(message, { disable_web_page_preview: true })
      : await post(message);
    if (route === "release") await pin(sent.message_id);
  }
  return new Response();
}

function selectRoute() {
  return ROUTES[new Date().getMinutes() % ROUTES.length];
}

type SendMessageOptions = Parameters<typeof bot.api.sendMessage>[2];

function post(text: string, options?: SendMessageOptions) {
  return bot.api.sendMessage(CHANNEL, text, { parse_mode: "HTML", ...options });
}

function pin(message_id: number) {
  return bot.api.pinChatMessage(CHANNEL, message_id);
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
