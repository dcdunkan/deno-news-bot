import env from "./env.ts";
import { Bot } from "https://deno.land/x/grammy@v1.10.1/mod.ts";

const bot = new Bot(env.BOT_TOKEN);
type SendMessageParams = Parameters<typeof bot.api.sendMessage>[2];

export function post(text: string, others?: SendMessageParams) {
  return bot.api.sendMessage(env.CHANNEL, text, others);
}

export function pin(message_id: number) {
  return bot.api.pinChatMessage(env.CHANNEL, message_id);
}

export function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
