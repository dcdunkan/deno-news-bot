import { Bot } from "https://deno.land/x/grammy@v1.10.1/mod.ts";
// import * as semver from "https://deno.land/std@0.152.0/semver/mod.ts";

let lastSent = 0;
const REPO = "denoland/deno";
const RECIPIENT = Number(Deno.env.get("RECIPIENT"));
const TOKEN = Deno.env.get("BOT_TOKEN");
if (!TOKEN || isNaN(RECIPIENT)) {
  throw new Error(
    "Make sure you have provided BOT_TOKEN and RECIPIENT env vars",
  );
}
const bot = new Bot(TOKEN);

interface Release {
  id: number;
  name: string;
  tag_name: string;
  html_url: string;
  body?: string;
}

// Deno Deploy hack
let skip = false;
setInterval(async () => {
  if (skip) {
    skip = false;
    return;
  }

  try {
    const release = await getLatestRelease();
    if (release && lastSent !== release.id) {
      lastSent = release.id;
      console.log(`New release: ${release.tag_name}`);
      // if (semver.patch(release.tag_name) == 0)
      await bot.api.sendMessage(
        RECIPIENT,
        `<b>Deno ${esc(release.name)}</b>\
${release.body ? `\n\n${esc(body(release.body))}...\n` : ""}
<a href="${release.html_url}">View full release details</a>`,
        { disable_web_page_preview: true, parse_mode: "HTML" },
      );
    }
  } catch (e) {
    console.trace(e);
  }

  skip = true;
}, 30.5 * 1000);

async function getLatestRelease() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
  );
  if (!res.ok) return;
  return (await res.json()) as Release;
}

function esc(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function body(str: string) {
  return str.split("\n").slice(2).join("\n").substring(0, 100);
}
