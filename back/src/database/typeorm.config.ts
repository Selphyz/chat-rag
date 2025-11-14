import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

// Use 'localhost' for local migrations, 'postgres' in Docker
const host = process.env.DATABASE_HOST ||
  (process.env.NODE_ENV === 'production' ? 'postgres' : 'localhost');

export default new DataSource({
  type: 'postgres',
  host,
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'chatrag',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
