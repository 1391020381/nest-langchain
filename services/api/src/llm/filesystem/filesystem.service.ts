import { Injectable } from "@nestjs/common";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createChatModel } from "../model.factory";
import { businessTools, writeFileTool } from "../tools/business.tools";

@Injectable()
export class FilesystemService {
  private model = createChatModel();

  async writeWorkspaceFile(filePath: string, content: string) {
    return writeFileTool.invoke({ filePath, content }) as Promise<{
      success: true;
      path: string;
    }>;
  }

  async fileChat(input: string) {
    const tools: StructuredToolInterface[] = [...businessTools];
    const toolMap: Record<string, StructuredToolInterface> = Object.fromEntries(
      tools.map((t) => [t.name, t])
    );
    const modelWithTools = this.model.bindTools(tools);

    const messages: BaseMessage[] = [
      new SystemMessage(
        "你是电商客服助手。可以调用 query_order、query_product、read_file、write_file 工具查询订单/商品/政策并写入工单。文件路径相对于 workspace，不要带 workspace/ 前缀。"
      ),
      new HumanMessage(input),
    ];

    let response = await modelWithTools.invoke(messages);
    messages.push(response);

    let guard = 0;
    while ((response.tool_calls?.length ?? 0) > 0 && guard < 5) {
      for (const toolCall of response.tool_calls ?? []) {
        const target = toolMap[toolCall.name];
        if (!target) continue;
        try {
          const toolResult = await target.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id!,
              content: JSON.stringify(toolResult),
            })
          );
        } catch (error) {
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id!,
              content: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            })
          );
        }
      }
      response = await modelWithTools.invoke(messages);
      messages.push(response);
      guard += 1;
    }

    return {
      result:
        response.content?.toString?.() ?? String(response.content ?? ""),
    };
  }
}
