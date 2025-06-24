import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { OutputConfig, AggregatedData } from '../types/config.types';
import { formatDate } from '../utils/date-utils';
import { extractNestedValue } from '../utils/json-utils';
import { GoogleSheetsService } from '../services/google-sheets.service';

export class CsvWriter {
  private config: OutputConfig;

  constructor(config: OutputConfig) {
    this.config = config;
  }

  async write(aggregatedData: AggregatedData): Promise<string> {
    const filename = this.generateFilename(aggregatedData.source);
    const records = this.flattenData(aggregatedData);

    // Ensure the directory exists
    const directory = path.dirname(filename);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const headers = this.config.columns.map(col => ({
      id: col.name,
      title: col.name,
    }));

    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: headers,
      append: false,
    });

    await csvWriter.writeRecords(records);

    // Google Sheets integration
    if (this.config.googleSheets) {
      // Check if Google Sheets can be initialized before creating the service
      if (GoogleSheetsService.canInitialize(this.config.googleSheets)) {
        try {
          console.log(`  📋 Integrating with Google Sheets...`);
          const googleSheetsService = new GoogleSheetsService(this.config.googleSheets);
          
          // Read the generated CSV content
          const csvContent = fs.readFileSync(filename, 'utf-8');
          
          await googleSheetsService.appendData(aggregatedData, csvContent);
          
          // Use sync version to avoid initialization issues
          const sheetUrl = googleSheetsService.getSheetUrlSync();
          console.log(`  📋 Google Sheets URL: ${sheetUrl}`);
        } catch (error) {
          console.error(`  ❌ Google Sheets integration failed:`, error);
          // Don't throw error to avoid breaking the main export process
        }
      } else if (!process.env.GOOGLE_SHEETS_ENABLED) {
        console.log('  📋 Google Sheets integration configured but disabled (set GOOGLE_SHEETS_ENABLED=true to enable)');
      } else {
        console.log('  📋 Google Sheets integration configured but credentials not found or invalid - skipping');
      }
    }

    return filename;
  }

  private generateFilename(sourceName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = this.config.filename;
    filename = filename.replace('{timestamp}', timestamp);
    filename = filename.replace('{source}', sourceName);
    return filename;
  }

  private flattenData(aggregatedData: AggregatedData): any[] {
    const records: any[] = [];

    for (const item of aggregatedData.data) {
      const record: any = {};

      for (const column of this.config.columns) {
        record[column.name] = this.extractValue(item, column.source, column.format, column.dateFormat);
      }

      records.push(record);
    }

    return records;
  }

  private extractValue(
    item: any,
    path: string,
    format?: string,
    dateFormat?: string
  ): any {
    const value = extractNestedValue(item, path);

    // Debug logging
    if (process.env.DEBUG) {
      console.log(`Extracting ${path}:`, {
        path,
        extractedValue: value,
        itemValue: item.value,
        itemValueType: typeof item.value,
        pathParts: path.split('.')
      });
    }

    if (value === null || value === undefined) {
      return '';
    }

    switch (format) {
      case 'json':
        return JSON.stringify(value);
      case 'date':
        if (typeof value === 'number') {
          return formatDate(new Date(value), dateFormat);
        }
        return value;
      case 'number':
        return Number(value);
      case 'string':
      default:
        return String(value);
    }
  }
}