/**
 * https://docs.langchain.com/oss/javascript/langchain/quickstart
 * Build a real-world agent — 2. Create tools
 */
import { tool } from "langchain";
import { pathToFileURL } from "node:url";
import * as z from "zod";

export const fetchTextFromUrl = tool(
  async ({ url }): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; quickstart-research/1.0)",
        },
        signal: controller.signal,
      });
      if (!resp.ok) {
        return `Fetch failed: HTTP ${resp.status} ${resp.statusText}`;
      }
      return await resp.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Fetch failed: ${message}`;
    } finally {
      clearTimeout(timeoutId);
    }
  },
  {
    name: "fetch_text_from_url",
    description: "Fetch the document from a URL.",
    schema: z.object({ url: z.string().url() }),
  },
);

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const text = await fetchTextFromUrl.invoke({ url: "https://docs.langchain.com/oss/javascript/langchain/quickstart" });
  console.log("text:",text);
}
