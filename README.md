# nest-langchain

跟书实践仓库：以《AI Agents 开发实践》为唯一学习主线，在本仓库按章从零生成工程代码。

> 远程仓库地址保持不变。旧版 Nest + LangChain 单应用练习代码已移除；历史学习笔记见 [`docs/archive/`](docs/archive/)。

## 本仓里有什么

| 内容 | 路径 | 说明 |
| --- | --- | --- |
| 课本 | [`docs/AI Agents 开发实践/`](docs/AI%20Agents%20开发实践/) | 序章 → 第二十章 + 终章 + 面试篇 |
| 学习进度 | [`docs/learning-path.md`](docs/learning-path.md) | 章节勾选、官方对照分支、当前下一步 |
| 应用工程 | 根目录（按章生成） | 从第二章起搭建 Bun monorepo；当前尚未生成 |

## 怎么学

1. 打开 [`docs/learning-path.md`](docs/learning-path.md)，按顺序读章。
2. 动手从**第二章：工程底座**开始，在本仓用书中步骤/Prompt 生成代码。
3. 需要对照时，只读参考 [autix-demo](https://github.com/Cookieboty/autix-demo) 的对应 `feat/*` 分支。
4. 每章验收通过后，在 `learning-path.md` 打勾。

## 当前状态

- [x] 清空旧 Nest 练习脚手架
- [x] 保留书稿并建立新学习路线
- [ ] 第二章 monorepo 工程底座（尚未开始）

当前下一步：阅读序章与第一章，然后开始第二章。

## 可选对照仓库

```bash
# 仅作只读参考，不要改成你的 origin
git clone https://github.com/Cookieboty/autix-demo.git ../autix-demo
```

## License

MIT
