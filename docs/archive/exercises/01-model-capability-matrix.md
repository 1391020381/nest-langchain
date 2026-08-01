# 进阶练习 1：模型能力矩阵

## 练习目标

不要只根据模型宣传或主观印象选模型。使用相同输入，对比模型在以下能力上的实际表现：

- 普通问答质量。
- 结构化输出稳定性。
- Tool Calling 参数正确性。
- Streaming 首 Token 延迟。
- 输入、输出和总 Token。

## 运行前准备

在 `.env` 中配置一个能够访问多个模型的 OpenAI 兼容服务：

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-provider.example/v1
```

启动项目：

```powershell
pnpm start:dev
```

接口：

```text
POST /api/exercises/01-model-capability-matrix
```

请求示例：

```json
{
  "models": ["model-a", "model-b"]
}
```

也可以在 Swagger 中运行：

```text
http://localhost:9001/docs
```

端口以 `.env` 的 `PORT` 为准。

## 实验内容

接口会对每个模型顺序执行四次调用：

| 能力         | 固定任务                | 关注指标                           |
| ------------ | ----------------------- | ---------------------------------- |
| 普通问答     | 解释 Runnable 的价值    | 准确性、简洁性、耗时、Token        |
| 结构化输出   | 分析生产故障工单        | Schema 成功、字段判断、Token       |
| Tool Calling | 计算 299 元商品九折价格 | 是否调用工具、参数是否为 299 和 10 |
| Streaming    | 解释流式输出的用户价值  | 首 Token 延迟、总耗时、Chunk 数    |

为了让对比有意义，所有模型使用完全相同的：

- temperature。
- System Message。
- Human Message。
- Zod Schema。
- Tool Schema 和描述。

## 结果记录

将接口返回值整理成表格：

| 指标               | 模型 A | 模型 B |
| ------------------ | -----: | -----: |
| 普通问答耗时       |        |        |
| 输入 Token         |        |        |
| 输出 Token         |        |        |
| 回答是否准确       |        |        |
| 结构化输出是否成功 |        |        |
| category 是否正确  |        |        |
| priority 是否正确  |        |        |
| Tool 是否调用      |        |        |
| Tool 参数是否正确  |        |        |
| 首 Token 延迟      |        |        |
| Streaming 总耗时   |        |        |

回答质量和字段正确性需要人工判断，不应只看请求是否成功。

## 代码阅读顺序

1. `src/exercises/dto/run-model-matrix.dto.ts`
2. `src/exercises/model-matrix.controller.ts`
3. `src/exercises/model-matrix.service.ts`
4. `src/exercises/model-matrix.service.spec.ts`
5. `src/langchain/model.factory.ts`

重点观察：

- 为什么模型需要使用同一组固定输入。
- 为什么不同能力分别捕获错误，而不是一个失败就终止整个实验。
- 为什么模型按顺序而不是并行运行。
- 为什么 Tool Calling 只检查模型请求的参数，不直接执行写操作。
- 首 Token 延迟与总耗时有什么区别。

## 需要你完成的改造

### 必做 1：重复实验

给 DTO 增加：

```ts
repeats: number;
```

限制范围为 1～5，默认值为 3。输出以下聚合指标：

- 平均普通问答耗时。
- 平均首 Token 延迟。
- 结构化输出成功率。
- Tool 参数正确率。
- Token 总量。

### 必做 2：增加人工评分

将每次结果保存成 JSON 文件或数据库记录，并增加人工评分：

```ts
{
  correctness: 1 | 2 | 3 | 4 | 5;
  clarity: 1 | 2 | 3 | 4 | 5;
  notes: string;
}
```

### 选做：成本估算

在配置中维护不同模型的输入和输出 Token 单价，根据 usage metadata 计算本次实验的估算成本。

不要把价格硬编码到 Service 中，因为模型价格会变化。

## 完成标准

- [ ] 至少成功比较两个模型。
- [ ] 能解释为什么模型选择不能只看普通聊天效果。
- [ ] 能区分首 Token 延迟和总耗时。
- [ ] 能判断结构化输出失败是模型能力、Schema 还是 Prompt 问题。
- [ ] 能解释 Tool Calling 成功与工具执行成功的区别。
- [ ] 完成至少三轮实验并计算平均值。
- [ ] 根据证据选择一个模型用于普通任务，一个模型用于复杂任务。

完成后，把实验表格和结论补充到本文末尾，再进入练习 2：Runnable 组合。

## 我的实验记录

> 运行接口后在这里填写模型、数据、结论和遇到的问题。
