import { Injectable } from '@nestjs/common';
import { tool } from 'langchain';
import { z } from 'zod';

export interface Order {
  id: string;
  ownerId: string;
  status: 'paid' | 'shipped' | 'completed';
  amount: number;
}

const ORDERS: Order[] = [
  { id: 'A1001', ownerId: 'user-1', status: 'shipped', amount: 299 },
  { id: 'A1002', ownerId: 'user-2', status: 'paid', amount: 99 },
];

@Injectable()
export class ToolkitService {
  getOrderForUser(orderId: string, currentUserId: string): Order | null {
    return ORDERS.find((order) => order.id === orderId && order.ownerId === currentUserId) ?? null;
  }

  calculateDiscount(amount: number, percent: number) {
    const discount = Number((amount * (percent / 100)).toFixed(2));
    return { original: amount, percent, discount, payable: Number((amount - discount).toFixed(2)) };
  }

  createTools(currentUserId: string) {
    const getOrder = tool(
      ({ orderId }) => {
        const order = this.getOrderForUser(orderId, currentUserId);
        return order ?? { error: '订单不存在或无权访问' };
      },
      {
        name: 'get_order',
        description: '查询当前登录用户自己的订单。不能查询其他用户的订单。',
        schema: z.object({ orderId: z.string().describe('订单号，例如 A1001') }),
      },
    );

    const calculateDiscount = tool(
      ({ amount, percent }) => this.calculateDiscount(amount, percent),
      {
        name: 'calculate_discount',
        description: '计算折扣金额和折后应付金额。',
        schema: z.object({
          amount: z.number().positive(),
          percent: z.number().min(0).max(100),
        }),
      },
    );

    return [getOrder, calculateDiscount];
  }
}
