import pdfParse from 'pdf-parse';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfParser {
  private readonly logger = new Logger(PdfParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PDF parsing error: ${message}`);
      throw new Error('Failed to parse PDF file');
    }
  }
}
