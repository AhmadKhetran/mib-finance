import { Module } from "@nestjs/common";
import { KpiController } from "./controllers/kpis.controller";
import { KpiService } from "./services/kpis.service";


@Module({
  imports: [],
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}
