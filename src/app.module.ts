import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agents/agent.module';
import { ExerciseModule } from './exercises/exercise.module';
import { GraphModule } from './graphs/graph.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LangChainModule } from './langchain/langchain.module';
import { ToolModule } from './tools/tool.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LangChainModule,
    ToolModule,
    KnowledgeModule,
    AgentModule,
    GraphModule,
    ExerciseModule,
  ],
})
export class AppModule {}
