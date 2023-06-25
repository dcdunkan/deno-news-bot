## Deno News

Script for posting Deno (https://deno.land) related updates such as release
info, blog posts, and other news from various official sources in a Telegram
channel. Currently posting at <https://t.me/deno_news>, join for updates.

#### Sources (5)

The bot currently fetches the posts from the following sources:

- <https://github.com/denoland/deno/releases/latest>
- <https://deno.com/blog>\*
- <https://deno.news/archive>\*
- <https://devblogs.microsoft.com/typescript>\*

> \*: Indicates that the feed has a custom Telegram Instant-View. See the
> `iv-rules` directory for the Instant-View rule source.

#### Setup

You don't need to set anything up, if you're only looking for the
realtime-updates. Just join: <https://t.me/deno_news>.

Setup a cron-job for calling the main end point every 1 minute. You need to set
the following environmental variables to make this work properly:

- BOT_TOKEN: Bot token of the Telegram bot.
- CHANNEL: Chat ID where the bot is allowed to send and pin messages (only
  release news are pinned).

> If you want to, you can also set a SECRET, which should be also added in the
> "Secret" header when requesting the server endpoint. This helps to avoid
> _anyone_ on the internet from requesting the server and triggering the feed
> fetching.

This project uses [Deno KV](https://deno.com/manual/runtime/kv). It currently
requires `--unstable` flag to run locally (this situation maybe changed, check
Deno KV documentation to make sure).
