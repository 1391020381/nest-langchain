import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentChatDto } from './dto/agent-chat.dto';
import { AgentService } from './agent.service';

@ApiTags('04 - Agent')
@Controller('agents')
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  @Post('order-assistant')
  @ApiOperation({ summary: '能够查询订单并计算折扣的工具型 Agent' })
  invoke(@Body() dto: AgentChatDto) {
    return this.agents.invoke(dto.message, dto.currentUserId);
  }
}
