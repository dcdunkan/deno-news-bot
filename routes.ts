// === ROUTES
// status/ (webhook)
// blog-news/ (cron)
// release/ (cron)

// Checks for blog posts that was published within the last 10 minutes
// in https://deno.com/blog, and posts the URL with Instant View.
// CRON JOB required. /blog-news endpoint must be called every 10 minutes
// for the best results.

import { esc, isNewPost, iv, pin, post } from "./helpers.ts";
import { parseFeed } from "https://deno.land/x/rss@0.5.6/mod.ts";

const BLOG_RSS_FEED = "https://deno.com/feed";

export async function blog() {
  const response = await fetch(BLOG_RSS_FEED);
  if (!response.ok) return;
  const content = await response.text();
  const feed = await parseFeed(content);
  const entry = feed.entries[0];
  if (!entry || !entry.published) return;
  if (!isNewPost(entry.published, 10)) return;

  const title = entry.title?.value!;
  const url = entry.links[0].href ?? entry.id;
  await post(
    `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`,
    { parse_mode: "HTML" },
  );
}

// Checks for news that was published within the last 10 minutes
// in https://deno.news, and posts the URL with Instant View.
// CRON JOB required. /blog-news endpoint must be called every 10 minutes
// for the best results.

const NEWS_RSS_FEED = "https://buttondown.email/denonews/rss";

export async function news() {
  const response = await fetch(NEWS_RSS_FEED);
  if (!response.ok) return;
  const content = await response.text();
  const feed = await parseFeed(content);
  const entry = feed.entries[0];
  if (!entry || !entry.published) return;
  if (!isNewPost(entry.published, 10)) return;

  const title = entry.title?.value!;
  const url = (entry.links[0].href ?? entry.id).replace(
    "https://buttondown.email/denonews/",
    "https://deno.news/",
  );
  await post(
    `<b>${esc(title)}</b>${iv(url)}\n\n${esc(url)}`,
    { parse_mode: "HTML" },
  );
}

// Checks for new releases that was published within the last 2 minutes
// in https://github.com/denoland/deno/releases, and posts the URL with
// Instant View. CRON JOB required. /release endpoint must be called
// every 2 minutes for the best results.

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

// Register a webhook at https://denostatus.com, pointing to /status
// endpoint of the application. Bot posts when there are new incidents
// and change in the status of the incident. (Does not posts when
// status of individual systems changes).

type Status = "Investigating" | "Identified" | "Monitoring" | "Resolved";
interface Incident {
  name: string;
  status: Status;
  affected_components: {
    name: string;
    status: string;
  }[];
  url: string;
}

const emoji: Record<Status, string> = {
  Investigating: "🔍",
  Identified: "🛠",
  Monitoring: "👀",
  Resolved: "✅",
};

export async function status(req: Request) {
  const data = await req.json() as { incident: Incident };
  if (data.incident === undefined) return;
  const {
    affected_components,
    name,
    status,
    url,
  } = data.incident;

  const affectedList = affected_components
    .map(({ name, status }) => esc(`• ${name}: ${status}`))
    .join("\n").substring(0, 2048);

  await post(
    `
${emoji[status]} Incident Report
<b>${esc(name)}</b>
Current Status: ${status}

<b>Affected Systems</b>
${affectedList}

${url}`,
    { disable_web_page_preview: true, parse_mode: "HTML" },
  );
}
