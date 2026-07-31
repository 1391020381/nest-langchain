import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AskDto {
  @ApiProperty({ example: '商品发货后能直接退款吗？' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  question!: string;

  @ApiPropertyOptional({ default: 4, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK = 4;
}
