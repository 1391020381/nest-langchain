import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { ModelDiagnosticsController } from "./model/model-diagnostics.controller";
import { ModelDiagnosticsService } from "./model/model-diagnostics.service";
import { AgentModule } from "./agent/agent.module";

@Module({
  imports: [AgentModule],
  controllers: [HealthController, ModelDiagnosticsController],
  providers: [ModelDiagnosticsService],
})
export class AppModule {}
