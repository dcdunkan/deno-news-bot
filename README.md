## Deno News

Script for posting Deno (https://deno.land) related updates such as release
info, blog posts, and other news from various official sources in a Telegram
channel. Currently posting at <https://t.me/deno_news>, join for updates.

#### Sources (7)

The bot currently fetches the posts from the following sources:

- <https://github.com/denoland/deno/releases/latest>
- <https://github.com/denoland/deno_std/releases/latest>
- <https://deno.com/blog>\*
- <https://v8.dev/blog>\*
- <https://deno.com/deploy/changelog>
- <https://deno.news/archive>\*
- <https://devblogs.microsoft.com/typescript>\*

> Refer to the main.ts file to find the RSS/Atom feed sources.

> \*: Indicates that the feed has a custom Telegram Instant-View. See the
> `iv-rules` directory for the Instant-View rule source. Also, I need help with
> keeping the instant views up-to-date. Contribute if you can.

#### Setup

You don't need to set anything up, if you're only looking for the
real-time updates. Just join: <https://t.me/deno_news>.

Setup a cron-job for calling the main end point every 1 minute. You need to set
the following environmental variables to make this work properly:

- BOT_TOKEN: Bot token of the Telegram bot.
- CHANNEL: Chat ID where the bot is allowed to send and pin messages (only
  release news are pinned).

> If you want to, you can also set a SECRET, which should be also added in the
> "Secret" header when requesting the server endpoint. This helps to avoid
> _anyone_ on the internet from requesting the server and triggering the feed
> fetching.

This project uses [Deno KV](https://docs.deno.com/deploy/kv/manual) to keep track
of the already sent feed entries and to keep track of the last pinned message.
