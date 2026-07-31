import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RunGraphDto {
  @ApiProperty({ example: '订单 A1001 已经发货，我想申请退款。' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @ApiPropertyOptional({ example: 'learning-thread-1' })
  @IsOptional()
  @IsString()
  threadId = 'learning-thread-1';
}
