import { config } from "https://deno.land/std@0.153.0/dotenv/mod.ts";
import { cleanEnv, num, str } from "https://deno.land/x/envalid@v0.0.3/mod.ts";

await config({ export: true });

export default cleanEnv(Deno.env.toObject(), {
  BOT_TOKEN: str(),
  CHANNEL: num(),
});
