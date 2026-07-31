import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatDto {
  @ApiProperty({ example: '用三句话解释 RunnableSequence' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @ApiPropertyOptional({ example: '你是一位擅长用示例教学的 LangChain 导师。' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string;
}
