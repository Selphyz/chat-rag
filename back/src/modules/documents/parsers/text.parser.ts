import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TextParser {
  private readonly logger = new Logger(TextParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Text parsing error: ${message}`);
      throw new Error('Failed to parse text file');
    }
  }
}
