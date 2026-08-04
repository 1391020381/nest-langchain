import type { AIUIResponse, UIResponse } from "./ui-types";

export function validateUIResponse(response: AIUIResponse): AIUIResponse {
  const message = response.message?.trim()
    ? response.message
    : "正在为您处理...";

  let components = (response.components ?? []).filter((comp: UIResponse) => {
    if (comp.type === "selection" && comp.options.length < 2) return false;
    if (comp.type === "form" && comp.fields.length === 0) return false;
    return true;
  });

  if (components.length > 5) {
    components = components.slice(0, 5);
  }

  return {
    ...response,
    version: "1.0",
    message,
    components,
  };
}
