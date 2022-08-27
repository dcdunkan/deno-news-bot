import { serve } from "https://deno.land/std@0.153.0/http/mod.ts";
import { blog } from "./blog.ts";
import { news } from "./news.ts";
import { release } from "./releases.ts";
import { status } from "./status.ts";

serve(async (req) => {
  const path = new URL(req.url).pathname.substring(1);

  try {
    if (req.method === "POST" && path === "status") {
      await status(req);
    } else if (path === "blog") {
      await blog();
    } else if (path === "release") {
      await release();
    } else if (path === "news") {
      await news();
    }
  } catch (_err) {
    //
  }

  return new Response();
});
