## Deno News

Script for posting Deno (https://deno.land) related updates such as release
info, blog posts, and other news from various official sources in a Telegram
channel. Currently posting at <https://t.me/deno_news>, join for updates.

#### Sources (5)

- Releases (<https://github.com/denoland/deno/releases/latest>)
- Deno Blog (<https://deno.com/blog>)
- Deno News (<https://deno.news/archive>)
- Deno Status (<https://denostatus.com>)
- TypeScript Blog (We &lt;3 TS) (<https://devblogs.microsoft.com/typescript>)

#### Setup

You don't need to, if you're only looking for the realtime-updates. Just join:
<https://t.me/deno_news>.

Setup a cron-job for calling the main end point every 1 minute. You need to set
the following environmental variables to make this work properly:

- BOT_TOKEN: Bot token of the Telegram bot.
- CHANNEL: Chat ID where the bot is allowed to send and pin messages (only
  release news are pinned).

and this project uses a stupid KV store powered by GitHub Gists
([Source Code](https://gist.github.com/dcdunkan/36b6329408f3a2a91881fa29c8e08c30)).
Why not an actual, proper KV store or DB? Idk, this is simply a tool and its not
aimed for general use. So I took the opportunity to mess around with Gists.
Anyway,

- GITHUB_PAT: GitHub's personal access token with `gists` scope enabled.
- GIST_RAW_URL: Yes, a raw URL to the Gist file. The required args will be
  parsed from it. It should be in the format:
  <https://gist.githubusercontent.com/owner/gist_id/raw(/revision)/file.json>
  (You can simply copy the URL of the `RAW` button shown with the file)

If you want to, you can also set a SECRET, which should be also added in the
headers when requesting the server.
