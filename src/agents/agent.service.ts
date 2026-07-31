import { Injectable } from '@nestjs/common';
import { createAgent } from 'langchain';
import { contentToText } from '../common/ai-content';
import { ModelFactory } from '../langchain/model.factory';
import { ToolkitService } from '../tools/toolkit.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly models: ModelFactory,
    private readonly toolkit: ToolkitService,
  ) {}

  async invoke(message: string, currentUserId: string) {
    const agent = createAgent({
      model: this.models.createChatModel(),
      tools: this.toolkit.createTools(currentUserId),
      systemPrompt: [
        '你是一个订单助手。',
        '只有用户明确提出订单或折扣问题时才调用工具。',
        '不得猜测订单信息；工具返回无权访问时必须直接说明。',
        '写操作在本课程阶段尚未开放。',
      ].join('\n'),
    });

    const result = await agent.invoke(
      { messages: [{ role: 'user', content: message }] },
      {
        recursionLimit: 10,
        tags: ['learning', 'order-agent'],
        metadata: { currentUserId },
      },
    );
    const last = result.messages.at(-1);

    return {
      answer: last ? contentToText(last.content) : '',
      steps: result.messages.map((item) => ({
        type: item.getType(),
        content: contentToText(item.content),
        toolCalls: 'tool_calls' in item ? item.tool_calls : undefined,
      })),
    };
  }
}
