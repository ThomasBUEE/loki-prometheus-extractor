import { GoogleSheetsConfig, AggregatedData } from '../types/config.types';
import { ConfigurationError, GoogleSheetsError } from '../utils/errors';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

export interface GoogleSheetsCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GoogleSheetsService {
  private config: GoogleSheetsConfig;
  private credentials?: GoogleSheetsCredentials;
  private auth?: JWT;
  private sheets?: sheets_v4.Sheets;
  private initialized = false;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
    // Don't load credentials or initialize auth in constructor
    // This will be done lazily when needed
  }

  /**
   * Static method to validate if Google Sheets can be configured without throwing errors
   */
  static canInitialize(config: GoogleSheetsConfig): boolean {
    if (!process.env.GOOGLE_SHEETS_ENABLED) {
      return false;
    }

    if (!config.spreadsheetId) {
      return false;
    }

    // Check if credentials are available
    if (config.credentials) {
      try {
        if (!fs.existsSync(config.credentials)) {
          return false;
        }
        // Try to parse the credentials file
        const credentialsContent = fs.readFileSync(config.credentials, 'utf-8');
        JSON.parse(credentialsContent);
        return true;
      } catch {
        return false;
      }
    }

    // Check environment variable
    if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
      try {
        JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.loadCredentials();
    this.initializeAuth();
    this.initialized = true;
  }

  private initializeAuth(): void {
    if (!this.credentials) {
      throw new ConfigurationError('Google Sheets credentials are required');
    }

    this.auth = new google.auth.JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  private loadCredentials(): void {
    if (this.config.credentials) {
      try {
        const credentialsContent = fs.readFileSync(this.config.credentials, 'utf-8');
        this.credentials = JSON.parse(credentialsContent);
      } catch (error) {
        throw new ConfigurationError(
          `Failed to load Google Sheets credentials from ${this.config.credentials}`
        );
      }
    } else {
      // Try to load from environment variables
      const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
      if (credentialsJson) {
        try {
          this.credentials = JSON.parse(credentialsJson);
        } catch (error) {
          throw new ConfigurationError(
            'Failed to parse Google Sheets credentials from environment variable'
          );
        }
      }
    }

    if (!this.credentials) {
      throw new ConfigurationError(
        'Google Sheets credentials not found. Please provide credentials file path or set GOOGLE_SHEETS_CREDENTIALS environment variable'
      );
    }
  }

  async appendData(data: AggregatedData, csvContent: string): Promise<void> {
    if (!process.env.GOOGLE_SHEETS_ENABLED) {
      console.log('  📋 Google Sheets integration disabled (set GOOGLE_SHEETS_ENABLED=true to enable)');
      return;
    }

    try {
      // Initialize credentials and auth only when needed
      await this.initialize();

      this.validateConfiguration();

      if (!this.sheets) {
        throw new GoogleSheetsError('Google Sheets API not initialized');
      }

      // Parse CSV content to 2D array
      const rawSheetData = this.parseCsvData(csvContent);

      if (rawSheetData.length === 0) {
        console.log('  ⚠️  No data to upload to Google Sheets');
        return;
      }

      // Truncate data if necessary to respect Google Sheets limits
      const { data: sheetData, truncatedCount } = this.truncateData(rawSheetData);

      if (truncatedCount > 0) {
        const limit = this.config.truncateLimit || 49000;
        console.log(`  ✂️  Truncated ${truncatedCount} cells that exceeded ${limit} characters`);
      }      // Determine the range to write to
      const sheetName = this.config.sheetName || 'Sheet1';

      // Create sheet if it doesn't exist (and it's not the default Sheet1)
      if (sheetName !== 'Sheet1') {
        await this.createSheetIfNotExists(sheetName);
      }

      // Properly escape sheet name for range if it contains spaces or special characters
      const escapedSheetName = this.escapeSheetName(sheetName);

      // Handle custom range - if user provided a range, use it as-is, otherwise construct it
      let range: string;
      if (this.config.range) {
        // If the range already contains a sheet name (format: SheetName!A1:B10), use it as-is
        // Otherwise, prepend the escaped sheet name
        if (this.config.range.includes('!')) {
          range = this.config.range;
        } else {
          range = `${escapedSheetName}!${this.config.range}`;
        }
      } else {
        // Default range
        range = `${escapedSheetName}!A1`;
      }

      // Now we can log with all variables defined
      console.log(`  📋 Uploading to Google Sheets...`);
      console.log(`     Spreadsheet: ${this.config.spreadsheetId}`);
      console.log(`     Sheet: ${sheetName}`);
      console.log(`     Escaped sheet name: ${escapedSheetName}`);
      console.log(`     Range: ${range}`);
      console.log(`     Mode: ${this.config.appendMode ? 'append' : 'overwrite'}`);
      console.log(`     Data points: ${data.data.length}`);
      console.log(`     CSV rows: ${sheetData.length}`);

      if (this.config.appendMode) {
        // In append mode, check if we should include headers
        const shouldSkipHeaders = !this.config.includeHeadersOnAppend;
        const dataToAppend = shouldSkipHeaders && sheetData.length > 1
          ? sheetData.slice(1)
          : sheetData;

        if (dataToAppend.length === 0) {
          console.log('  ⚠️  No data rows to append');
          return;
        }

        // Append data to the sheet
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.config.spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: dataToAppend
          }
        });

        const skipMessage = shouldSkipHeaders ? ' (headers skipped)' : '';
        console.log(`  ✅ Successfully appended ${dataToAppend.length} rows to Google Sheets${skipMessage}`);
      } else {
        // Overwrite/update data in the sheet (include headers)
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: sheetData
          }
        });
        console.log(`  ✅ Successfully updated ${sheetData.length} rows in Google Sheets`);
      }

      // Log the Google Sheets URL
      console.log(`  🔗 View at: ${this.getSheetUrlSync()}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ❌ Failed to upload to Google Sheets: ${errorMessage}`);

      // Don't throw the error to prevent breaking the main export process
      // Log it and continue
      if (error instanceof Error && error.message.includes('403')) {
        console.error('  🔐 Make sure the service account has edit access to the spreadsheet');
      } else if (error instanceof Error && error.message.includes('404')) {
        console.error('  📄 Make sure the spreadsheet ID is correct and accessible');
      }
    }
  }

  private validateConfiguration(): void {
    if (!this.config.spreadsheetId) {
      throw new ConfigurationError('Google Sheets spreadsheetId is required');
    }

    if (!this.credentials) {
      throw new ConfigurationError('Google Sheets credentials are required');
    }

    // Validate spreadsheet ID format (should be a Google Sheets ID)
    const spreadsheetIdRegex = /^[a-zA-Z0-9-_]{20,}$/;
    if (!spreadsheetIdRegex.test(this.config.spreadsheetId)) {
      throw new ConfigurationError(
        `Invalid Google Sheets spreadsheet ID format: ${this.config.spreadsheetId}`
      );
    }
  }

  private parseCsvData(csvContent: string): string[][] {
    // Parse CSV content into 2D array for Google Sheets API
    const lines = csvContent.split('\n').filter(line => line.trim());

    return lines.map(line => {
      // More robust CSV parsing that handles quoted fields with commas
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          // Toggle quote state (ignore escaped quotes)
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = '';
        } else {
          // Add character to current field
          current += char;
        }
      }

      // Add the last field
      if (current) {
        result.push(current.trim());
      }

      // Clean up quoted fields
      return result.map(cell => {
        // Remove surrounding quotes and unescape internal quotes
        if (cell.startsWith('"') && cell.endsWith('"')) {
          return cell.slice(1, -1).replace(/\\"/g, '"');
        }
        return cell;
      });
    });
  }

  async getSheetUrl(): Promise<string> {
    const baseUrl = 'https://docs.google.com/spreadsheets/d';
    const sheetUrl = `${baseUrl}/${this.config.spreadsheetId}`;

    // If we have a specific sheet name and it's not the default, try to get the GID
    if (this.config.sheetName && this.config.sheetName !== 'Sheet1' && this.sheets) {
      try {
        const spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: this.config.spreadsheetId
        });

        const sheet = spreadsheet.data.sheets?.find(
          s => s.properties?.title === this.config.sheetName
        );

        if (sheet && sheet.properties?.sheetId !== undefined) {
          return `${sheetUrl}#gid=${sheet.properties.sheetId}`;
        }
      } catch (error) {
        // If we can't get the sheet info, just return the basic URL
        console.warn('Could not retrieve sheet GID, using basic URL');
      }
    }

    return sheetUrl;
  }

  getSheetUrlSync(): string {
    // Synchronous version for immediate use
    const baseUrl = 'https://docs.google.com/spreadsheets/d';
    return `${baseUrl}/${this.config.spreadsheetId}`;
  }

  async createSheetIfNotExists(sheetName: string): Promise<void> {
    if (!this.sheets) {
      throw new GoogleSheetsError('Google Sheets API not initialized');
    }

    try {
      console.log(`  🔍 Checking if sheet '${sheetName}' exists...`);

      // Check if the sheet already exists
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId
      });

      const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
      console.log(`  📋 Existing sheets: ${existingSheets.join(', ')}`);

      const sheetExists = spreadsheet.data.sheets?.some(
        s => s.properties?.title === sheetName
      );

      if (!sheetExists) {
        console.log(`  ➕ Creating new sheet: '${sheetName}'`);
        // Create the new sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
        console.log(`  ✅ Successfully created sheet: '${sheetName}'`);
      } else {
        console.log(`  ✅ Sheet '${sheetName}' already exists`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ❌ Failed to create/check sheet '${sheetName}': ${errorMessage}`);
      throw new GoogleSheetsError(`Failed to create sheet '${sheetName}': ${errorMessage}`);
    }
  }

  private escapeSheetName(sheetName: string): string {
    // If sheet name contains spaces, special characters, or starts with a number,
    // it needs to be enclosed in single quotes for Google Sheets API
    if (/[\s'!]/.test(sheetName) || /^\d/.test(sheetName)) {
      // Escape single quotes by doubling them and wrap in single quotes
      return `'${sheetName.replace(/'/g, "''")}'`;
    }
    return sheetName;
  }

  public truncateData(data: string[][]): { data: string[][], truncatedCount: number } {
    const limit = this.config.truncateLimit || 49000; // Default to 49k to stay under 50k limit
    const suffix = this.config.truncateSuffix || '...[truncated]';
    let truncatedCount = 0;

    const truncatedData = data.map(row =>
      row.map(cell => {
        if (typeof cell === 'string' && cell.length > limit) {
          truncatedCount++;
          const truncatedCell = cell.substring(0, limit - suffix.length) + suffix;
          return truncatedCell;
        }
        return cell;
      })
    );

    return { data: truncatedData, truncatedCount };
  }
}
