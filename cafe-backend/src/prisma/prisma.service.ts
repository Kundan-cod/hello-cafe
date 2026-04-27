import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const dbUrl = process.env.DATABASE_URL || '';

    // Use SQLite for local development (file-based database)
    if (dbUrl.startsWith('file:') || dbUrl.includes('.db') || dbUrl === '') {
      // SQLite - use libsql adapter
      const adapter = new PrismaLibSql({ url: dbUrl });
      super({ adapter });
    } else {
      // PostgreSQL - use adapter for connection pooling
      const pool = new Pool({ connectionString: dbUrl });
      const adapter = new PrismaPg(pool);
      super({ adapter });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  get client() {
    return this;
  }
}
