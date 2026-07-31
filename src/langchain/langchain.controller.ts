import { Body, Controller, MessageEvent, Post, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatDto } from './dto/chat.dto';
import { ExtractTicketDto } from './dto/extract-ticket.dto';
import { LangChainService } from './langchain.service';

@ApiTags('01 - Models & Runnables')
@Controller('langchain')
export class LangChainController {
  constructor(private readonly langchain: LangChainService) {}

  @Post('chat')
  @ApiOperation({ summary: '基础 Chat Model 调用' })
  chat(@Body() dto: ChatDto) {
    return this.langchain.chat(dto.message, dto.systemPrompt);
  }

  @Post('runnables')
  @ApiOperation({ summary: 'RunnableSequence 与 RunnableParallel 实践' })
  runnableDemo(@Body() dto: ExtractTicketDto) {
    return this.langchain.runnableDemo(dto.text);
  }

  @Post('structured-output')
  @ApiOperation({ summary: '使用 Zod 进行工单结构化提取' })
  extractTicket(@Body() dto: ExtractTicketDto) {
    return this.langchain.extractTicket(dto.text);
  }

  @Sse('stream')
  @ApiOperation({ summary: '通过 SSE 流式输出模型 Token' })
  stream(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const controller = new AbortController();

      void (async () => {
        try {
          for await (const token of this.langchain.stream('介绍 LangChain Runnable 的核心价值')) {
            if (controller.signal.aborted) break;
            subscriber.next({ type: 'token', data: { token } });
          }
          subscriber.next({ type: 'completed', data: {} });
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => controller.abort();
    });
  }
}
