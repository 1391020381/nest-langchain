import { GraphService } from './graph.service';

describe('GraphService', () => {
  it('根据意图路由，并在同一 thread 中累计状态', async () => {
    const service = new GraphService();

    const first = await service.invoke('我要退款', 'test-thread');
    const second = await service.invoke('再处理一次退款', 'test-thread');

    expect(first.route).toBe('refund');
    expect(first.visits).toBe(1);
    expect(second.visits).toBe(2);
  });
});
