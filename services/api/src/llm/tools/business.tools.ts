import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const WORKSPACE_ROOT = path.join(process.cwd(), "workspace");

export function safePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath);
  const root = path.resolve(WORKSPACE_ROOT);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("路径不允许逃逸工作目录");
  }
  return resolved;
}

export const queryOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const full = safePath(`orders/${orderId}.json`);
    if (!fs.existsSync(full)) return { error: `订单 ${orderId} 不存在` };
    return JSON.parse(fs.readFileSync(full, "utf8"));
  },
  {
    name: "query_order",
    description: "根据订单号查询订单详情、商品、收货时间和状态",
    schema: z.object({
      orderId: z.string().describe("订单号，例如 EC20240315001"),
    }),
  }
);

export const queryProductTool = tool(
  async ({ productId }: { productId: string }) => {
    const full = safePath(`products/${productId}.json`);
    if (!fs.existsSync(full)) return { error: `商品 ${productId} 不存在` };
    return JSON.parse(fs.readFileSync(full, "utf8"));
  },
  {
    name: "query_product",
    description: "根据商品 ID 查询参数、保修和售后信息",
    schema: z.object({
      productId: z.string().describe("商品 ID，例如 headphone-x1"),
    }),
  }
);

export const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    const full = safePath(filePath);
    if (!fs.existsSync(full)) return { error: "文件不存在" };
    return { content: fs.readFileSync(full, "utf8") };
  },
  {
    name: "read_file",
    description: "读取政策、FAQ 或其他业务文件",
    schema: z.object({
      filePath: z.string().describe("相对于 workspace 的文件路径"),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content }: { filePath: string; content: string }) => {
    const full = safePath(filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    return { success: true, path: filePath };
  },
  {
    name: "write_file",
    description: "写入工单、售后报告或日报",
    schema: z.object({
      filePath: z.string().describe("相对于 workspace 的文件路径"),
      content: z.string().describe("要写入的内容"),
    }),
  }
);

export const businessTools = [
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
];
