import "https://deno.land/std@0.156.0/dotenv/load.ts";
import { Bot } from "https://deno.land/x/grammy@v1.11.1/mod.ts";
import { parseExpression } from "https://esm.sh/cron-parser@4.6.0";

// Instant View rule hashes for linking websites.
// See rules/ directory for the sources.
const RHASHES: Record<string, string> = {
  // https://deno.news/archive
  "deno.news": "b5ba1c523db473",
  // https://deno.com/blog
  "deno.com": "28aee3eda1037a",
  // https://github.com/denoland/deno/releases/tag/x
  "github.com": "877b90c98613a6",
};

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const CHANNEL = Number(Deno.env.get("CHANNEL"));
if (!BOT_TOKEN || isNaN(CHANNEL)) {
  throw new Error("Missing/Invalid Environment Variables");
}

export function isNewPost(
  cronExp: string,
  currentDate: Date,
  published: Date,
) {
  const parsed = parseExpression(cronExp, { currentDate });
  const lastCheckedOn = parsed.prev().toDate().valueOf();
  const publishedOn = published.valueOf();
  return lastCheckedOn < publishedOn ? true : false;
}

const ZWSP = "\u200b"; // zero-width space character
export function iv(url: string) {
  const rhash = RHASHES[new URL(url).hostname];
  return `<a href="https://t.me/iv?rhash=${rhash}&url=${url}">${ZWSP}</a>`;
}

export function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const bot = new Bot(BOT_TOKEN);

export function post(
  text: string,
  others?: Parameters<typeof bot.api.sendMessage>[2],
) {
  return bot.api.sendMessage(CHANNEL, text, others);
}

export function pin(message_id: number) {
  return bot.api.pinChatMessage(CHANNEL, message_id);
}
