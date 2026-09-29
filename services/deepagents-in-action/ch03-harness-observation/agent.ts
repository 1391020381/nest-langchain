import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createDeepAgent } from "deepagents";

import { getWeatherTool } from "../ch01-langchain-foundations/weather-tool";

export const DEFAULT_HARNESS_QUESTION =
  "请查询杭州的模拟天气，制定并完成任务清单，把包含天气数据和出行建议的报告写入 /work/weather-report.md，最后概括结果。";

/**
 * 第二阶段只显式提供 Model、业务 Tool 和业务 Prompt。
 * Agent loop、Todo、虚拟文件系统和上下文管理由 createDeepAgent 组装。
 */
export function createObservedWeatherAgent(model: BaseChatModel) {
  return createDeepAgent({
    model,
    tools: [getWeatherTool],
    systemPrompt: `你是用于观察 DeepAgent Harness 的中文教学助手。
每次运行必须按以下顺序完成：
1. 首先使用 write_todos 创建任务清单，并把当前步骤标记为 in_progress；
2. 使用 get_weather 获取用户指定城市的模拟天气；
3. 使用 write_file 把天气数据、模拟数据声明和简短出行建议写入 /work/weather-report.md；
4. 将所有 todo 更新为 completed；
5. 最终回复概括结果，并说明报告文件路径。
不要虚构工具结果，不要跳过任务清单或报告文件。`,
  });
}

