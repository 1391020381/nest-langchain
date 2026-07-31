import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddDocumentDto {
  @ApiProperty({ example: '退款规则：商品发货前可无条件退款，发货后需人工审核。' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content!: string;

  @ApiPropertyOptional({ example: { source: 'refund-policy.md', department: 'support' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
