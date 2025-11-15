import * as mammoth from 'mammoth';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DocxParser {
  private readonly logger = new Logger(DocxParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DOCX parsing error: ${message}`);
      throw new Error('Failed to parse DOCX file');
    }
  }
}
