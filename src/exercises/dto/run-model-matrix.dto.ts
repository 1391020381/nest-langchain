import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches } from 'class-validator';

export class RunModelMatrixDto {
  @ApiProperty({
    description: '使用同一个 OPENAI_BASE_URL 对比的模型名称，建议一次选择两个。',
    example: ['gpt-5-mini', 'gpt-5.4-mini'],
    minItems: 1,
    maxItems: 3,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9._:/-]+$/, {
    each: true,
    message: '模型名称只能包含字母、数字、点、下划线、冒号、斜杠和连字符',
  })
  models!: string[];
}
