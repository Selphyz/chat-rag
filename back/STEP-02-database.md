# Step 2: Database Setup with TypeORM

**Estimated Time:** 2-3 hours
**Prerequisites:** Step 1 completed, PostgreSQL running

---

## Overview

In this step, we'll set up the database layer using TypeORM:
- Configure TypeORM with PostgreSQL
- Create database entities
- Set up migrations
- Create repository patterns
- Test database connectivity

---

## 1. TypeORM Configuration

### 1.1 Update `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.user'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('nodeEnv') === 'development', // Only for dev!
        logging: configService.get('nodeEnv') === 'development',
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 1.2 Create `src/database/typeorm.config.ts` (for migrations)

```typescript
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'chatrag',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
```

---

## 2. Database Entities

### 2.1 User Entity - `src/modules/auth/entities/user.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Chat } from '../../chat/entities/chat.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @OneToMany(() => Chat, (chat) => chat.user)
  chats: Chat[];

  @OneToMany(() => Document, (document) => document.user)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 2.2 Chat Entity - `src/modules/chat/entities/chat.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Message } from './message.entity';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.chats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Message, (message) => message.chat, { cascade: true })
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 2.3 Message Entity - `src/modules/chat/entities/message.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chat } from './chat.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column({
    type: 'enum',
    enum: MessageRole,
  })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 2.4 Document Entity - `src/modules/documents/entities/document.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { DocumentChunk } from './document-chunk.entity';

export enum DocumentStatus {
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  filename: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PROCESSING,
  })
  status: DocumentStatus;

  @Column('text', { nullable: true })
  error: string;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.document, { cascade: true })
  chunks: DocumentChunk[];

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 2.5 DocumentChunk Entity - `src/modules/documents/entities/document-chunk.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  @Column('text')
  content: string;

  @Column({ name: 'vector_id' })
  vectorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## 3. Migrations Setup

### 3.1 Add Migration Scripts to `package.json`

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs",
    "migration:generate": "npm run typeorm -- migration:generate -d src/database/typeorm.config.ts",
    "migration:run": "npm run typeorm -- migration:run -d src/database/typeorm.config.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/database/typeorm.config.ts",
    "migration:show": "npm run typeorm -- migration:show -d src/database/typeorm.config.ts",
    "schema:drop": "npm run typeorm -- schema:drop -d src/database/typeorm.config.ts",
    "schema:sync": "npm run typeorm -- schema:sync -d src/database/typeorm.config.ts"
  }
}
```

### 3.2 Generate Initial Migration

```bash
npm run migration:generate -- src/database/migrations/InitialSchema
```

### 3.3 Run Migrations

```bash
npm run migration:run
```

### 3.4 Example Migration File

If you need to create a migration manually:

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class InitialSchema1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'password',
            type: 'varchar',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create chats table
    await queryRunner.createTable(
      new Table({
        name: 'chats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'chats',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Continue for other tables...
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('messages');
    await queryRunner.dropTable('document_chunks');
    await queryRunner.dropTable('documents');
    await queryRunner.dropTable('chats');
    await queryRunner.dropTable('users');
  }
}
```

---

## 4. Database Service Pattern

### 4.1 Create Base Repository

Create `src/common/base.repository.ts`:

```typescript
import { Repository, FindOptionsWhere, FindManyOptions } from 'typeorm';

export class BaseRepository<T> {
  constructor(private repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findOne(where: FindOptionsWhere<T>): Promise<T> {
    return this.repository.findOne({ where });
  }

  async findById(id: string): Promise<T> {
    return this.repository.findOneBy({ id } as any);
  }

  async create(entity: Partial<T>): Promise<T> {
    const newEntity = this.repository.create(entity as any);
    return this.repository.save(newEntity);
  }

  async update(id: string, entity: Partial<T>): Promise<T> {
    await this.repository.update(id, entity as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
```

---

## 5. Module Setup

### 5.1 Create Auth Module - `src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  exports: [TypeOrmModule],
})
export class AuthModule {}
```

### 5.2 Create Chat Module - `src/modules/chat/chat.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, Message])],
  exports: [TypeOrmModule],
})
export class ChatModule {}
```

### 5.3 Create Documents Module - `src/modules/documents/documents.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk])],
  exports: [TypeOrmModule],
})
export class DocumentsModule {}
```

### 5.4 Update `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.user'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('nodeEnv') === 'development',
        logging: configService.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ChatModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## 6. Database Validation & Testing

### 6.1 Test Database Connection

Update `src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async healthCheck() {
    const isDbConnected = this.dataSource.isInitialized;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: isDbConnected,
        type: this.dataSource.options.type,
      },
    };
  }

  @Get('health/db')
  async databaseHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }
}
```

### 6.2 Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db
```

### 6.3 Verify Tables in PostgreSQL

```bash
docker exec -it chatrag-postgres psql -U postgres -d chatrag -c "\dt"
```

Expected output:
```
              List of relations
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | chats           | table | postgres
 public | document_chunks | table | postgres
 public | documents       | table | postgres
 public | messages        | table | postgres
 public | users           | table | postgres
```

### 6.4 Query Tables

```bash
docker exec -it chatrag-postgres psql -U postgres -d chatrag -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

---

## 7. Seeding (Optional)

### 7.1 Create Seed Script - `src/database/seeds/seed.ts`

```typescript
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import typeormConfig from '../typeorm.config';
import { User } from '../../modules/auth/entities/user.entity';

async function seed() {
  const dataSource = await typeormConfig.initialize();

  console.log('🌱 Seeding database...');

  // Create test user
  const userRepository = dataSource.getRepository(User);

  const hashedPassword = await bcrypt.hash('password123', 10);

  const testUser = userRepository.create({
    email: 'test@example.com',
    password: hashedPassword,
  });

  await userRepository.save(testUser);

  console.log('✅ Test user created: test@example.com / password123');

  await dataSource.destroy();
  console.log('🎉 Seeding complete!');
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
```

Add to `package.json`:
```json
{
  "scripts": {
    "seed": "ts-node src/database/seeds/seed.ts"
  }
}
```

Run seed:
```bash
npm run seed
```

---

## 8. Common Issues & Troubleshooting

### Issue: "relation does not exist"
**Solution:** Run migrations
```bash
npm run migration:run
```

### Issue: "Cannot find module typeorm"
**Solution:** Install dependencies
```bash
npm install typeorm pg
```

### Issue: Migration files not found
**Solution:** Check paths in `typeorm.config.ts`
```typescript
entities: ['src/**/*.entity.ts'],
migrations: ['src/database/migrations/*.ts'],
```

### Issue: Synchronize not working
**Solution:** Set `synchronize: true` only in development, use migrations in production

### Issue: UUID not working
**Solution:** Enable UUID extension in PostgreSQL
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 9. Best Practices

1. **Never use `synchronize: true` in production** - Always use migrations
2. **Use transactions** for complex operations
3. **Index frequently queried columns** (userId, chatId, etc.)
4. **Use cascade carefully** - Understand delete behavior
5. **Validate data** before saving to database
6. **Use QueryBuilder** for complex queries
7. **Implement soft deletes** for important data
8. **Log queries** in development, not production

---

## 10. Next Steps

✅ **Step 2 Complete! You should now have:**
- TypeORM configured with PostgreSQL
- All database entities created
- Migrations setup and running
- Database health checks
- Module structure in place

**Continue to Step 3:** Authentication Module with JWT

---

## Quick Commands Reference

```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migrations status
npm run migration:show

# Drop entire schema (CAUTION!)
npm run schema:drop

# Access database directly
docker exec -it chatrag-postgres psql -U postgres -d chatrag

# View all tables
docker exec -it chatrag-postgres psql -U postgres -d chatrag -c "\dt"

# View table structure
docker exec -it chatrag-postgres psql -U postgres -d chatrag -c "\d users"
```
