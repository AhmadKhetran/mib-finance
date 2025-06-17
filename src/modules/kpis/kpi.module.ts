import { Module } from "@nestjs/common";
import { KpiController } from "./controllers/kpis.controller";
import { KpiService } from "./services/kpis.service";
import { MssqlService } from "./db/db.service";


@Module({
  imports: [],
  controllers: [KpiController],
  providers: [KpiService, MssqlService],
})
export class KpiModule {}
