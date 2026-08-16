import { providerKeyUrls } from "./constants.ts";
import { HttpError } from "./http.ts";

function serviceForUrl(url: string) {
  if (url.includes("deapi.ai")) return "DEAPI";
  if (url.includes("openai.com")) return "OpenAI";
  if (url.includes("googleapis.com")) return "Google Gemini";
  if (url.includes("anthropic.com")) return "Anthropic";
  if (url.includes("github.com")) return "GitHub";
  return "The API";
}

export function friendlyHttpError(error: HttpError) {
  const service = serviceForUrl(error.url);
  if (error.status === 401) {
    const next = service === "DEAPI"
      ? ` Run \`flux config\` to check whether the key comes from the environment or keychain, then replace it with \`flux config key\`. ${providerKeyUrls.deapi}`
      : " Check or replace the selected prompt-provider key with `flux config key`.";
    return `${service} authentication failed (401).${next}`;
  }
  if (error.status === 403) {
    if (service === "GitHub") return "GitHub declined the release check (403). Try again later.";
    const next = service === "DEAPI"
      ? ` Check the key's permissions and account credits. ${providerKeyUrls.deapi}`
      : " Check the key's permissions or select another prompt model.";
    return `${service} denied this request (403).${next}`;
  }
  return `${service} request failed (${error.status}): ${error.message}`;
}
