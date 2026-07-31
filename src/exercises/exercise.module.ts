import { Module } from '@nestjs/common';
import { LangChainModule } from '../langchain/langchain.module';
import { ModelMatrixController } from './model-matrix.controller';
import { ModelMatrixService } from './model-matrix.service';

@Module({
  imports: [LangChainModule],
  controllers: [ModelMatrixController],
  providers: [ModelMatrixService],
})
export class ExerciseModule {}
