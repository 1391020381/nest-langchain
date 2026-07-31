import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddDocumentDto } from './dto/add-document.dto';
import { AskDto } from './dto/ask.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('03 - RAG')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post('documents')
  @ApiOperation({ summary: '切分并写入教学用内存向量库' })
  addDocument(@Body() dto: AddDocumentDto) {
    return this.knowledge.addDocument(dto.content, dto.metadata);
  }

  @Post('search')
  @ApiOperation({ summary: '相似度检索，返回内容、元数据和得分' })
  search(@Body() dto: AskDto) {
    return this.knowledge.search(dto.question, dto.topK);
  }

  @Post('ask')
  @ApiOperation({ summary: '固定两阶段 RAG：先检索，再生成带引用回答' })
  ask(@Body() dto: AskDto) {
    return this.knowledge.ask(dto.question, dto.topK);
  }
}
