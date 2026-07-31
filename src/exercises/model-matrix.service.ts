import { Injectable } from '@nestjs/common';
import { BaseMessage, HumanMessage, SystemMessage } from 'langchain';
import { tool } from 'langchain';
import { z } from 'zod';
import { contentToText } from '../common/ai-content';
import { ModelFactory } from '../langchain/model.factory';

const ticketSchema = z.object({
  category: z.enum(['account', 'system_error', 'billing', 'feature_request', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

const discountTool = tool(
  ({ amount, discountPercent }) => {
    const payable = amount * (1 - discountPercent / 100);
    return {
      amount,
      discountPercent,
      payable: Number(payable.toFixed(2)),
    };
  },
  {
    name: 'calculate_discount',
    description: '根据商品原价和优惠百分比计算应付金额。',
    schema: z.object({
      amount: z.number().positive().describe('商品原价'),
      discountPercent: z.number().min(0).max(100).describe('优惠百分比，例如九折对应 10'),
    }),
  },
);

export interface CapabilityResult<T> {
  success: boolean;
  elapsedMs: number;
  value?: T;
  error?: string;
}

@Injectable()
export class ModelMatrixService {
  constructor(private readonly models: ModelFactory) {}

  async run(modelNames: string[]) {
    const results = [];

    // 顺序运行，减少瞬时限流，也让延迟数据更容易比较。
    for (const modelName of modelNames) {
      results.push(await this.evaluateModel(modelName));
    }

    return {
      experiment: {
        callsPerModel: 4,
        note: '每个模型执行四次请求，可能产生模型费用。不同模型需由同一 OPENAI_BASE_URL 提供。',
        fixedInputs: {
          qa: '用不超过 120 个中文字符解释 LangChain Runnable 的价值。',
          structured: '生产环境登录后白屏，所有销售均无法工作，今天必须恢复。',
          toolCalling: '商品原价 299 元，现在打九折。请调用工具计算应付金额。',
          streaming: '用三点说明流式输出改善用户体验的原因。',
        },
      },
      results,
      compareBy: [
        '普通问答：answer 是否准确、qa.elapsedMs、usage',
        '结构化输出：structured.success 和字段质量',
        '工具调用：toolCalling.value.argumentCheckPassed',
        '流式输出：streaming.value.firstTokenMs 和 totalMs',
      ],
    };
  }

  private async evaluateModel(modelName: string) {
    const model = this.models.createChatModel(0, modelName);

    const qa = await this.capture(async () => {
      const response = await model.invoke([
        new SystemMessage('你是一位严谨的 LangChain.js 教师。'),
        new HumanMessage('用不超过 120 个中文字符解释 LangChain Runnable 的价值。'),
      ]);
      return {
        answer: contentToText(response.content),
        usage: response.usage_metadata ?? null,
      };
    });

    const structured = await this.capture(async () => {
      const extractor = model.withStructuredOutput(ticketSchema, {
        name: 'support_ticket',
        includeRaw: true,
      });
      const response = await extractor.invoke([
        new SystemMessage('分析工单，只根据输入判断，不得补充不存在的事实。'),
        new HumanMessage('生产环境登录后白屏，所有销售均无法工作，今天必须恢复。'),
      ]);

      return {
        parsed: response.parsed,
        usage: this.readUsage(response.raw),
      };
    });

    const toolCalling = await this.capture(async () => {
      const modelWithTools = model.bindTools([discountTool]);
      const response = await modelWithTools.invoke([
        new SystemMessage('涉及折扣计算时必须调用 calculate_discount 工具，不要自己计算。'),
        new HumanMessage('商品原价 299 元，现在打九折。请调用工具计算应付金额。'),
      ]);
      const calls = response.tool_calls ?? [];
      const discountCall = calls.find((call) => call.name === 'calculate_discount');
      const args = discountCall?.args as { amount?: number; discountPercent?: number } | undefined;

      return {
        called: Boolean(discountCall),
        calls,
        argumentCheckPassed: args?.amount === 299 && args.discountPercent === 10,
        expectedArguments: { amount: 299, discountPercent: 10 },
        usage: response.usage_metadata ?? null,
      };
    });

    const streaming = await this.captureStreaming(model);

    return { model: modelName, qa, structured, toolCalling, streaming };
  }

  private async capture<T>(operation: () => Promise<T>): Promise<CapabilityResult<T>> {
    const startedAt = Date.now();
    try {
      const value = await operation();
      return {
        success: true,
        elapsedMs: Date.now() - startedAt,
        value,
      };
    } catch (error) {
      return {
        success: false,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async captureStreaming(model: ReturnType<ModelFactory['createChatModel']>): Promise<
    CapabilityResult<{
      firstTokenMs: number | null;
      totalMs: number;
      chunkCount: number;
      characterCount: number;
      answer: string;
    }>
  > {
    const startedAt = Date.now();
    let firstTokenMs: number | null = null;
    let chunkCount = 0;
    let answer = '';

    try {
      const stream = await model.stream([
        new SystemMessage('你是一位简洁的 AI 应用开发教师。'),
        new HumanMessage('用三点说明流式输出改善用户体验的原因。'),
      ]);

      for await (const chunk of stream) {
        const text = contentToText(chunk.content);
        if (!text) continue;
        firstTokenMs ??= Date.now() - startedAt;
        chunkCount += 1;
        answer += text;
      }

      const totalMs = Date.now() - startedAt;
      return {
        success: true,
        elapsedMs: totalMs,
        value: {
          firstTokenMs,
          totalMs,
          chunkCount,
          characterCount: answer.length,
          answer,
        },
      };
    } catch (error) {
      return {
        success: false,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private readUsage(message: BaseMessage): unknown {
    return 'usage_metadata' in message ? message.usage_metadata : null;
  }
}
