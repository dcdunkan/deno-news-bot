import { serve } from "https://deno.land/std@0.158.0/http/mod.ts";
import { blog, news, release, status } from "./routes.ts";

const SECRET = Deno.env.get("SECRET");

serve(async (req) => {
  const date = new Date(); // time the request recieved.
  const paths = new URL(req.url).pathname.split("/");
  const secretHeader = req.headers.get("secret");
  if (SECRET !== undefined && secretHeader !== SECRET) {
    return new Response("unauthorized");
  }
  try {
    if (req.method === "POST" && paths[1] === "status") {
      await status(req);
    } else if (paths[1] === "blog-news") {
      await Promise.all([blog(date), news(date)]);
    } else if (paths[1] === "release") {
      await release(date);
    }
  } catch (_err) {
    //
  }
  return new Response();
});
