import { serve } from "https://deno.land/std@0.153.0/http/mod.ts";
import { blog, news, release, status } from "./routes.ts";

const SECRET = Deno.env.get("SECRET");

serve(async (req) => {
  const paths = new URL(req.url).pathname.split("/");
  if (paths[2] !== SECRET) {
    return new Response("unauthorized");
  }

  try {
    if (req.method === "POST" && paths[1] === "status") {
      await status(req);
    } else if (paths[1] === "blog-news") {
      await Promise.all([
        await blog(),
        await news(),
      ]);
    } else if (paths[1] === "release") {
      await release();
    }
  } catch (_err) {
    //
  }

  return new Response();
});
