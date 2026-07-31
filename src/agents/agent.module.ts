import { Module } from '@nestjs/common';
import { LangChainModule } from '../langchain/langchain.module';
import { ToolModule } from '../tools/tool.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [LangChainModule, ToolModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
