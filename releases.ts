// Checks for new releases that was published within the last 2 minutes
// in https://github.com/denoland/deno/releases, and posts the URL with
// Instant View.
// CRON JOB required. /release endpoint must be called every 2 minutes
// for the best results.

import { esc, isNewPost, iv, pin, post } from "./helpers.ts";

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

const RELEASES_API_URL =
  "https://api.github.com/repos/denoland/deno/releases/latest";

export async function release() {
  const response = await fetch(RELEASES_API_URL);
  if (!response.ok) return;
  const release = await response.json() as Release;
  if (!release || !release.published_at) return;
  if (!isNewPost(new Date(release.published_at), 2)) return;

  const msg = await post(
    `<b>Deno ${esc(release.name)}</b>${iv(release.html_url)}\
${release.body ? `\n\n${esc(body(release.body))}\n` : ""}
<a href="${release.html_url}">...view full release details</a>`,
    { parse_mode: "HTML" },
  );
  await pin(msg.message_id);
}
