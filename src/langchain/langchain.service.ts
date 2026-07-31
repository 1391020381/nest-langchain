import { Injectable } from '@nestjs/common';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableParallel, RunnableSequence } from '@langchain/core/runnables';
import { HumanMessage, SystemMessage } from 'langchain';
import { z } from 'zod';
import { contentToText } from '../common/ai-content';
import { ModelFactory } from './model.factory';

const ticketSchema = z.object({
  category: z
    .enum(['account', 'system_error', 'billing', 'feature_request', 'other'])
    .describe('工单类别'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).describe('优先级'),
  summary: z.string().describe('一句话摘要'),
  needHuman: z.boolean().describe('是否需要人工处理'),
  reasons: z.array(z.string()).describe('判断依据'),
});

@Injectable()
export class LangChainService {
  constructor(private readonly models: ModelFactory) {}

  async chat(message: string, systemPrompt?: string) {
    const model = this.models.createChatModel();
    const startedAt = Date.now();
    const response = await model.invoke([
      new SystemMessage(systemPrompt ?? '你是一位严谨的 LangChain.js 学习助手。'),
      new HumanMessage(message),
    ]);

    return {
      content: contentToText(response.content),
      usage: response.usage_metadata,
      elapsedMs: Date.now() - startedAt,
    };
  }

  async runnableDemo(text: string) {
    const model = this.models.createChatModel();
    const outputParser = new StringOutputParser();

    const summarize = RunnableSequence.from([
      ChatPromptTemplate.fromTemplate('将以下内容压缩为三句话：\n\n{text}'),
      model,
      outputParser,
    ]);
    const keywords = RunnableSequence.from([
      ChatPromptTemplate.fromTemplate(
        '从以下内容提取 3～5 个关键词，只返回逗号分隔结果：\n\n{text}',
      ),
      model,
      outputParser,
    ]);
    const parallel = RunnableParallel.from({ summary: summarize, keywords });

    return parallel.invoke(
      { text },
      { tags: ['learning', 'runnable-parallel'], metadata: { lesson: 1 } },
    );
  }

  async extractTicket(text: string) {
    const structuredModel = this.models
      .createChatModel()
      .withStructuredOutput(ticketSchema, { name: 'support_ticket' });

    return structuredModel.invoke([
      new SystemMessage('分析用户工单。只根据输入判断，不要补充不存在的事实。'),
      new HumanMessage(text),
    ]);
  }

  async *stream(message: string): AsyncGenerator<string> {
    const stream = await this.models
      .createChatModel()
      .stream([
        new SystemMessage('你是一位简洁的 LangChain.js 学习助手。'),
        new HumanMessage(message),
      ]);

    for await (const chunk of stream) {
      const text = contentToText(chunk.content);
      if (text) {
        yield text;
      }
    }
  }
}
