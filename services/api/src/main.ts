import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadLangChainConfig } from "./config/load-langchain-config";

async function bootstrap() {
  process.env.OPENAI_MODEL ??= loadLangChainConfig().llm.model;
  const { AppModule } = require("./app.module") as typeof import("./app.module");
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API service running on http://localhost:${port}`);
}

bootstrap();
