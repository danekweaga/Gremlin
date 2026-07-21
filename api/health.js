import { getProviderConfig, sendJson } from "../lib/vercel-api.mjs";

export default function handler(request, response) {
  if (request.method !== "GET") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const provider = getProviderConfig();
  return sendJson(response, 200, {
    ok: true,
    provider: provider?.name || "demo",
    model: provider?.model || null,
    aiConfigured: Boolean(provider),
  });
}
