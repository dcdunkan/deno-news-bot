// 2 Minute Cron Job required.
import { esc, pin, post } from "./bot.ts";
import { difference } from "https://deno.land/std@0.153.0/datetime/mod.ts";

interface Release {
  id: number;
  name: string;
  tag_name: string;
  html_url: string;
  published_at: string;
  body?: string;
}

function body(str: string) {
  return str.split("\n").slice(2).join("\n").substring(0, 512);
}

export async function release() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/denoland/deno/releases/latest",
    );
    if (response.ok) {
      const release = await response.json() as Release;
      if (release && release.published_at) {
        const diff = difference(new Date(release.published_at), new Date());
        if (diff.milliseconds! <= 2 * 60 * 1000) {
          const msg = await post(
            `<b>Deno ${esc(release.name)} 🦕</b>\
${release.body ? `\n\n${esc(body(release.body))}\n` : ""}
<a href="${release.html_url}">...view full release details</a>`,
            { disable_web_page_preview: true, parse_mode: "HTML" },
          );
          await pin(msg.message_id);
        }
      }
    }
  } catch (e) {
    console.trace(e);
  }

  return new Response();
}
