// src/mssql/mssql.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class MssqlService implements OnModuleDestroy {
  private pool: sql.ConnectionPool;

  async getConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      const config: sql.config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        server: process.env.DB_HOST,
        database: process.env.DB_NAME,
        options: {
          encrypt: true,
          trustServerCertificate: true,
          requestTimeout: 60000,
        },
      };

      this.pool = await sql.connect(config);
      console.log('✅ MSSQL connection established');
    }
    return this.pool;
  }

  async query<T = any>(query: string, params?: { [key: string]: any }): Promise<T[]> {
    const pool = await this.getConnection();
    const request = pool.request();

    if (params) {
      for (const key in params) {
        request.input(key, params[key]);
      }
    }

    const result = await request.query<T>(query);
    return result.recordset;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      console.log('🛑 MSSQL connection closed');
    }
  }
}
