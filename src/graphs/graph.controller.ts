import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RunGraphDto } from './dto/run-graph.dto';
import { GraphService } from './graph.service';

@ApiTags('05 - LangGraph')
@Controller('graphs')
export class GraphController {
  constructor(private readonly graphs: GraphService) {}

  @Post('support-router')
  @ApiOperation({ summary: '条件路由与 MemorySaver 会话状态示例' })
  invoke(@Body() dto: RunGraphDto) {
    return this.graphs.invoke(dto.message, dto.threadId);
  }

  @Get('support-router/mermaid')
  @ApiOperation({ summary: '导出工作流 Mermaid 图' })
  mermaid() {
    return this.graphs.mermaid();
  }
}
