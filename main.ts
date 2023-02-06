import { load } from "https://deno.land/std@0.176.0/dotenv/mod.ts";
import { serve } from "https://deno.land/std@0.176.0/http/mod.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.7/mod.ts";
import { KV } from "https://ghc.deno.dev/dcdunkan/1kv@ff40ec2/mod.ts";
import { Bot } from "https://deno.land/x/grammy@v1.14.1/mod.ts";

await load({ export: true });
const env = Deno.env.toObject() as {
  KV_URL: string;
  KV_SECRET: string;
  BOT_TOKEN: string;
  SECRET: string;
};

const kv = new KV(env.KV_URL, env.KV_SECRET);
const bot = new Bot(env.BOT_TOKEN);
const CHANNEL = Number(Deno.env.get("CHANNEL"));
if (isNaN(CHANNEL)) throw new Error("CHANNEL should be a channel ID");
const ZWSP = "\u200b"; // zero-width space character
// See rules/ directory for the sources.
const RHASHES: Record<string, string> = {
  "deno.news": "b5ba1c523db473", // https://deno.news/archive
  "deno.com": "28aee3eda1037a", // https://deno.com/blog
  "devblogs.microsoft.com": "24952bb2da22c6", // https://devblogs.microsoft.com/
  // "github.com": "877b90c98613a6", // not used (cuz its hard to maintain)
};
const URLS = {
  blog: "https://deno.com/feed",
  news: "https://buttondown.email/denonews/rss",
  status: "https://denostatus.com/history.rss",
  release: "https://api.github.com/repos/denoland/deno/releases/latest",
  typescript: "https://devblogs.microsoft.com/typescript/feed/",
};

async function getLatestEntries(url: string, key: string) {
  const response = await fetch(url);
  const textFeed = await response.text();
  const feed = await parseFeed(textFeed);
  const entries: typeof feed.entries = [];
  const res = await kv.get(key);
  if (!res.ok) throw res.error;
  for (const entry of feed.entries) {
    if (entry.id === res.value) break;
    entries.unshift(entry); // FIFO
  }
  if (entries.length !== 0) {
    await kv.edit(key, { value: feed.entries[0].id });
  }
  return entries;
}

const routes: Record<string, () => Promise<string[]>> = {
  "blog": async () => {
    const entries = await getLatestEntries(URLS.blog, "deno_news_blog");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  "news": async () => {
    const entries = await getLatestEntries(URLS.news, "deno_news_news");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
  "status": async () => {
    const entries = await getLatestEntries(URLS.status, "deno_news_status");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${esc(url)}`;
    });
  },
  "release": async () => {
    const response = await fetch(URLS.release);
    const release = await response.json();
    const res = await kv.get("deno_news_release");
    if (!res.ok) throw res.error;
    if (res.value === release.id) return [];
    await kv.edit("deno_news_release", { value: release.id });
    return [`<b>${esc(release.name)}</b>\n\n${esc(release.html_url)}`];
  },
  "typescript": async () => {
    const entries = await getLatestEntries(URLS.typescript, "deno_news_ts");
    return entries.map((entry) => {
      const title = entry.title?.value!;
      const url = entry.links[0].href ?? entry.id;
      return `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`;
    });
  },
};

serve(async (req: Request) => {
  const [, path] = new URL(req.url).pathname.split("/");
  if (routes[path] === undefined) return new Response();
  const secretHeader = req.headers.get("secret");
  if (env.SECRET !== undefined && secretHeader !== env.SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const messages = await routes[path]();
  for (const message of messages) {
    const sent = await post(message);
    if (path === "release") await pin(sent.message_id);
  }
  return Response.json(messages);
}, {
  onError: (err) => {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  },
});

function post(text: string) {
  return bot.api.sendMessage(CHANNEL, text, { parse_mode: "HTML" });
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
