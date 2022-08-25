import { blog } from "./blog.ts";
import { release } from "./releases.ts";
import { status } from "./status.ts";
import { serve } from "https://deno.land/std@0.153.0/http/mod.ts";

serve(async (req) => {
  const path = new URL(req.url).pathname.substring(1);

  if (path === "incident") {
    return await status(req);
  } else if (path === "blog") {
    return await blog();
  } else if (path === "release") {
    return await release();
  }

  return new Response();
});
