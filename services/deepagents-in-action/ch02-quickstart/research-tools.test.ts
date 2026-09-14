import { test } from "node:test";
import assert from "node:assert/strict";
import { createInternetSearch } from "./research-tools";

test("搜索传递默认参数及认证，并保留可引用来源", async () => {
  const request = (async (url, init) => {
    assert.equal(url, "https://api.tavily.com/search");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
    assert.deepEqual(JSON.parse(init?.body as string), {
      query: "LangGraph", max_results: 5, topic: "general",
      include_raw_content: false, search_depth: "basic", include_answer: false,
    });
    return Response.json({ results: [{ title: "Docs", url: "https://example.com/docs", content: "测试资料", raw_content: "全文" }] });
  }) as typeof fetch;
  const result = JSON.parse(await createInternetSearch("test-key", request).invoke({ query: "LangGraph" }));
  assert.equal(result.results[0].url, "https://example.com/docs");
  assert.equal(result.results[0].content, "测试资料");
  assert.equal(result.results[0].raw_content, undefined);
});

test("原文选项与内容长度限制", async () => {
  const request = (async () => Response.json({ results: [{
    title: "Docs", url: "https://example.com", content: "a".repeat(9000), raw_content: "b".repeat(13000),
  }] })) as typeof fetch;
  const result = JSON.parse(await createInternetSearch("test-key", request).invoke({ query: "test", include_raw_content: true }));
  assert.equal(result.results[0].content.length, 8000);
  assert.equal(result.results[0].raw_content.length, 12000);
});

test("空结果正常返回，认证错误不泄露响应体，拒绝损坏的响应", async () => {
  const tool = (response: Response) => createInternetSearch("test-key", (async () => response) as typeof fetch);
  assert.deepEqual(JSON.parse(await tool(Response.json({ results: [] })).invoke({ query: "test" })).results, []);
  await assert.rejects(tool(new Response("secret", { status: 401 })).invoke({ query: "test" }), (error: Error) => {
    assert.match(error.message, /HTTP 401/);
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
  await assert.rejects(tool(Response.json({ unexpected: [] })).invoke({ query: "test" }), /无法识别/);
  assert.throws(() => createInternetSearch(""), /TAVILY_API_KEY/);
});
