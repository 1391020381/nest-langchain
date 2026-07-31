import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ExtractTicketDto {
  @ApiProperty({ example: '生产环境登录后白屏，影响所有销售，今天必须恢复。' })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  text!: string;
}
