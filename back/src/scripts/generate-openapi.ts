import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { dump } from 'js-yaml';
import { AppModule } from '../app.module';
import { createSwaggerDocument } from '../config/swagger.config';

async function generateOpenApiSpecs() {
  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    const document = createSwaggerDocument(app);
    const outputDir = join(process.cwd(), 'openapi');

    await mkdir(outputDir, { recursive: true });

    await writeFile(
      join(outputDir, 'openapi.json'),
      JSON.stringify(document, null, 2),
    );

    await writeFile(join(outputDir, 'openapi.yaml'), dump(document));

    console.log(`✅ OpenAPI specs generated under ${outputDir}`);
  } finally {
    await app.close();
  }
}

generateOpenApiSpecs().catch((error) => {
  console.error('❌ Failed to generate OpenAPI specs', error);
  process.exit(1);
});
