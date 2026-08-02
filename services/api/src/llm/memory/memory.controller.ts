import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { RunnableMemoryService } from "./runnable-memory.service";

@Controller("api/memory")
export class MemoryController {
  constructor(private readonly memory: RunnableMemoryService) {}

  @Post("chat")
  chat(@Body() body: { sessionId: string; input: string }) {
    return this.memory.chat(body.sessionId, body.input);
  }

  @Get("history")
  history(@Query("sessionId") sessionId: string) {
    return this.memory.getHistory(sessionId);
  }

  @Delete("clear")
  clear(@Query("sessionId") sessionId: string) {
    this.memory.clearSession(sessionId);
    return { cleared: true, sessionId };
  }
}
