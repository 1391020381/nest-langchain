import { Injectable } from '@nestjs/common';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';

const SupportState = Annotation.Root({
  message: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => '',
  }),
  route: Annotation<'refund' | 'knowledge'>({
    reducer: (_previous, next) => next,
    default: () => 'knowledge',
  }),
  answer: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => '',
  }),
  visits: Annotation<number>({
    reducer: (_previous, next) => next,
    default: () => 0,
  }),
});

@Injectable()
export class GraphService {
  private readonly checkpointer = new MemorySaver();

  private readonly graph = new StateGraph(SupportState)
    .addNode('router', (state) => ({
      route: /退款|refund/i.test(state.message) ? ('refund' as const) : ('knowledge' as const),
      visits: state.visits + 1,
    }))
    .addNode('refund', (state) => ({
      answer: `退款流程需要核验订单状态并经过审批。当前会话已执行 ${state.visits} 次。`,
    }))
    .addNode('knowledge', (state) => ({
      answer: `已进入知识问答流程。当前会话已执行 ${state.visits} 次。`,
    }))
    .addEdge(START, 'router')
    .addConditionalEdges('router', (state) => state.route, {
      refund: 'refund',
      knowledge: 'knowledge',
    })
    .addEdge('refund', END)
    .addEdge('knowledge', END)
    .compile({ checkpointer: this.checkpointer });

  invoke(message: string, threadId: string) {
    return this.graph.invoke(
      { message },
      {
        configurable: { thread_id: threadId },
        tags: ['learning', 'langgraph-routing'],
      },
    );
  }

  async mermaid() {
    const drawable = await this.graph.getGraphAsync();
    return { mermaid: drawable.drawMermaid() };
  }
}
