import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class ModelFactory {
  constructor(private readonly config: ConfigService) {}

  createChatModel(temperature = 0): ChatOpenAI {
    const apiKey = this.required('OPENAI_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL');

    return new ChatOpenAI({
      apiKey,
      model: this.config.get<string>('CHAT_MODEL') ?? 'gpt-5-mini',
      temperature,
      configuration: baseURL ? { baseURL } : undefined,
      maxRetries: 2,
      timeout: 60_000,
    });
  }

  createEmbeddings(): OpenAIEmbeddings {
    const apiKey = this.required('OPENAI_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL');

    return new OpenAIEmbeddings({
      apiKey,
      model: this.config.get<string>('EMBEDDING_MODEL') ?? 'text-embedding-3-small',
      configuration: baseURL ? { baseURL } : undefined,
      maxRetries: 2,
      timeout: 60_000,
    });
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(
        `缺少 ${name}，请复制 .env.example 为 .env 并配置模型服务。`,
      );
    }
    return value;
  }
}
