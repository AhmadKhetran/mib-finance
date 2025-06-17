import { Module } from "@nestjs/common";
import {  KpiModule } from "./modules/kpis/kpi.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    KpiModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
