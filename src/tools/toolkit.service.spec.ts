import { ToolkitService } from './toolkit.service';

describe('ToolkitService', () => {
  const service = new ToolkitService();

  it('只允许用户读取自己的订单', () => {
    expect(service.getOrderForUser('A1001', 'user-1')?.id).toBe('A1001');
    expect(service.getOrderForUser('A1001', 'user-2')).toBeNull();
  });

  it('准确计算折扣', () => {
    expect(service.calculateDiscount(299, 10)).toEqual({
      original: 299,
      percent: 10,
      discount: 29.9,
      payable: 269.1,
    });
  });
});
