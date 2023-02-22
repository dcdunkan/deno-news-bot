<samp>
<!-- Yes, I like making it look monospaced. -->

### Deno News

Script for posting Deno (https://deno.land/) related updates such as release
info, blog posts, and other news from various official sources in a Telegram
Channel. Currently posting at https://t.me/deno_news, join for updates.

Sources (5):

- Releases (GitHub API)
- Deno Blog (https://deno.com/blog)
- Deno News (https://deno.news)
- Deno Status (RSS feed of https://denostatus.com)
- TypeScript Blog (cuz y not?) (https://devblogs.microsoft.com/typescript)

Setup a cron-job for calling the main end point every 1 minute. You need to set
BOT_TOKEN, CHANNEL environmental variables. If you want to, you can also set a
SECRET, which should be also added in the headers when requesting the server.

</samp>
