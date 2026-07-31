import { AIMessage, AIMessageChunk } from 'langchain';
import { ModelFactory } from '../langchain/model.factory';
import { ModelMatrixService } from './model-matrix.service';

describe('ModelMatrixService', () => {
  it('汇总普通调用、结构化输出、工具调用和流式指标', async () => {
    const fakeModel = {
      invoke: jest.fn().mockResolvedValue(
        new AIMessage({
          content: 'Runnable 提供统一组合协议。',
          usage_metadata: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
        }),
      ),
      withStructuredOutput: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          parsed: {
            category: 'system_error',
            priority: 'critical',
            summary: '生产环境登录白屏',
            confidence: 0.98,
          },
          raw: new AIMessage({
            content: '',
            usage_metadata: { input_tokens: 20, output_tokens: 12, total_tokens: 32 },
          }),
        }),
      }),
      bindTools: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue(
          new AIMessage({
            content: '',
            tool_calls: [
              {
                id: 'call-1',
                name: 'calculate_discount',
                args: { amount: 299, discountPercent: 10 },
                type: 'tool_call',
              },
            ],
            usage_metadata: { input_tokens: 16, output_tokens: 9, total_tokens: 25 },
          }),
        ),
      }),
      stream: jest.fn().mockImplementation(async function* () {
        yield new AIMessageChunk({ content: '第一点' });
        yield new AIMessageChunk({ content: '第二点' });
      }),
    };
    const factory = {
      createChatModel: jest.fn().mockReturnValue(fakeModel),
    } as unknown as ModelFactory;
    const service = new ModelMatrixService(factory);

    const result = await service.run(['model-a']);
    const modelResult = result.results[0];

    expect(modelResult.qa.success).toBe(true);
    expect(modelResult.structured.success).toBe(true);
    expect(modelResult.toolCalling.value?.argumentCheckPassed).toBe(true);
    expect(modelResult.streaming.value?.chunkCount).toBe(2);
    expect(factory.createChatModel).toHaveBeenCalledWith(0, 'model-a');
  });
});
