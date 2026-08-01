import { Injectable } from "@nestjs/common";
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { createChatModel } from "./model.factory";

const SYSTEM = "你是一名需求结构化抽取助手";

@Injectable()
export class LlmService {
  private model = createChatModel();

  async invokeDemo(input: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM),
      new HumanMessage(
        `请从下面文本中抽取 action、constraints、entities：\n${input}`
      ),
    ];
    const response = await this.model.invoke(messages);
    return response.content.toString();
  }

  async streamDemo(input: string) {
    return this.model.stream([
      new SystemMessage(SYSTEM),
      new HumanMessage(`请逐步分析并输出结构化抽取结果：\n${input}`),
    ]);
  }

  async batchDemo(inputs: string[]): Promise<string[]> {
    const messageGroups = inputs.map((input) => [
      new SystemMessage(SYSTEM),
      new HumanMessage(`请抽取 action、constraints、entities：\n${input}`),
    ]);
    const responses = await this.model.batch(messageGroups);
    return responses.map((item) => item.content.toString());
  }
}
