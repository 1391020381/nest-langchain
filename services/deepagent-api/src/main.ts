import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";

config({ path: join(process.cwd(), ".env") });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port);
  console.log(`DeepAgent API listening on http://localhost:${port}`);
}

void bootstrap();
