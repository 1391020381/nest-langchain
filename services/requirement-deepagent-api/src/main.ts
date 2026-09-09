import "reflect-metadata";
import { resolve } from "node:path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadAllowedModelEnvironment } from "./bootstrap/load-model-env";

function parsePort(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536
    ? parsed
    : 4_200;
}

function allowedProductionOrigins(value: string | undefined): string[] {
  return (value ?? "http://localhost:3200")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const serviceRoot = resolve(__dirname, "..");
  loadAllowedModelEnvironment(serviceRoot);

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin:
      process.env.NODE_ENV === "production"
        ? allowedProductionOrigins(process.env.REQUIREMENT_WEB_ORIGINS)
        : true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Trace-Id"],
  });

  const port = parsePort(process.env.PORT);
  await app.listen(port, "0.0.0.0");
  Logger.log(
    `Requirement DeepAgent API listening on http://localhost:${port}`,
    "Bootstrap",
  );
}

void bootstrap();
