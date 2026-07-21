import {
  analyzeFeature,
  parseFeatureRequest,
  requestOrigin,
  sendJson,
} from "../lib/vercel-api.mjs";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  let input;
  try {
    input = parseFeatureRequest(request.body);
  } catch {
    return sendJson(response, 400, { error: "Send a valid feature request and estimate." });
  }

  if (input.error) return sendJson(response, 400, { error: input.error });

  const result = await analyzeFeature(input.feature, input.estimate, {
    requestOrigin: requestOrigin(request),
  });
  return sendJson(response, 200, result);
}
