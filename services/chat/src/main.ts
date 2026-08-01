import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3002",
    credentials: true,
  });
  const port = process.env.PORT ?? 4001;
  await app.listen(port);
  console.log(`Chat service running on http://localhost:${port}`);
}

bootstrap();
