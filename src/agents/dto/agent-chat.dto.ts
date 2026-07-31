import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AgentChatDto {
  @ApiProperty({ example: '帮我查一下 A1001，然后计算九折价格。' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @ApiPropertyOptional({
    example: 'user-1',
    description: '教学示例字段；生产环境应从认证 Guard 获取，不能由请求体提供。',
  })
  @IsOptional()
  @IsString()
  currentUserId = 'user-1';
}
