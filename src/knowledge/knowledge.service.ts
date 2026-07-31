import { Injectable } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ModelFactory } from '../langchain/model.factory';

@Injectable()
export class KnowledgeService {
  private vectorStore?: MemoryVectorStore;

  constructor(private readonly models: ModelFactory) {}

  async addDocument(content: string, metadata: Record<string, unknown> = {}) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 120,
    });
    const documentId = crypto.randomUUID();
    const chunks = await splitter.splitDocuments([
      new Document({
        pageContent: content,
        metadata: { ...metadata, documentId },
      }),
    ]);

    const store = this.getVectorStore();
    await store.addDocuments(chunks);

    return { documentId, chunks: chunks.length, metadata };
  }

  async search(query: string, topK = 4) {
    const store = this.getVectorStore();
    const results = await store.similaritySearchWithScore(query, topK);

    return results.map(([document, score]) => ({
      content: document.pageContent,
      metadata: document.metadata,
      score,
    }));
  }

  async ask(question: string, topK = 4) {
    const retrieved = await this.search(question, topK);
    const context = retrieved
      .map((item, index) => `[来源 ${index + 1}]\n${item.content}`)
      .join('\n\n');

    const chain = RunnableSequence.from([
      ChatPromptTemplate.fromMessages([
        [
          'system',
          [
            '你是知识库问答助手，只能根据给定资料回答。',
            '资料没有答案时，明确回答“当前知识库没有相关信息”。',
            '回答中的事实必须使用 [来源 n] 标注。',
          ].join('\n'),
        ],
        ['human', '资料：\n{context}\n\n问题：{question}'],
      ]),
      this.models.createChatModel(),
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({ context, question });
    return { answer, sources: retrieved };
  }

  private getVectorStore(): MemoryVectorStore {
    this.vectorStore ??= new MemoryVectorStore(this.models.createEmbeddings());
    return this.vectorStore;
  }
}
