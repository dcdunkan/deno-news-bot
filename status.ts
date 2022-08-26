// Register a webhook at https://denostatus.com, pointing to /status
// endpoint of the application. Bot posts when there are new incidents
// and change in the status of the incident. (Does not posts when
// status of individual systems changes).

import { esc, post } from "./helpers.ts";

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
