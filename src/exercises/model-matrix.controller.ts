import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RunModelMatrixDto } from './dto/run-model-matrix.dto';
import { ModelMatrixService } from './model-matrix.service';

@ApiTags('Exercises')
@Controller('exercises')
export class ModelMatrixController {
  constructor(private readonly matrix: ModelMatrixService) {}

  @Post('01-model-capability-matrix')
  @ApiOperation({
    summary: '练习 1：比较模型的问答、结构化输出、Tool Calling 和流式能力',
  })
  run(@Body() dto: RunModelMatrixDto) {
    return this.matrix.run(dto.models);
  }
}
