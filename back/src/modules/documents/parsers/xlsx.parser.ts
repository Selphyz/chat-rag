import * as XLSX from 'xlsx';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class XlsxParser {
  private readonly logger = new Logger(XlsxParser.name);

  async parse(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        text += `\n### Sheet: ${sheetName}\n${csv}\n`;
      });

      return text.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`XLSX parsing error: ${message}`);
      throw new Error('Failed to parse XLSX file');
    }
  }
}
