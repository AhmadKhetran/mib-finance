import { Module } from "@nestjs/common";
import {  KpiModule } from "./modules/kpis/kpi.module";

@Module({
  imports: [
    KpiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
