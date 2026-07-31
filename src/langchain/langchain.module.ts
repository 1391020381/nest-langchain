import { Module } from '@nestjs/common';
import { LangChainController } from './langchain.controller';
import { LangChainService } from './langchain.service';
import { ModelFactory } from './model.factory';

@Module({
  controllers: [LangChainController],
  providers: [LangChainService, ModelFactory],
  exports: [LangChainService, ModelFactory],
})
export class LangChainModule {}
