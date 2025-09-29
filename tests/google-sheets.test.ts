import { GoogleSheetsService } from '../src/services/google-sheets.service';
import { GoogleSheetsConfig, AggregatedData } from '../src/types/config.types';
import { ConfigurationError } from '../src/utils/errors';
import * as fs from 'fs';

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({
        authorize: jest.fn().mockResolvedValue(true)
      }))
    },
    sheets: jest.fn().mockReturnValue({
      spreadsheets: {
        values: {
          append: jest.fn().mockResolvedValue({ data: {} }),
          update: jest.fn().mockResolvedValue({ data: {} })
        },
        get: jest.fn().mockResolvedValue({
          data: {
            sheets: [
              { properties: { title: 'Sheet1', sheetId: 0 } },
              { properties: { title: 'TestSheet', sheetId: 123456789 } }
            ]
          }
        }),
        batchUpdate: jest.fn().mockResolvedValue({ data: {} })
      }
    })
  }
}));

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('GoogleSheetsService', () => {
  const mockCredentials = {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com'
  };

  const mockConfig: GoogleSheetsConfig = {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    sheetName: 'TestSheet',
    credentials: 'config/google-sheets-credentials.json',
    appendMode: true,
    range: 'A1'
  };

  const mockAggregatedData: AggregatedData = {
    source: 'test-source',
    data: [
      {
        timestamp: 1719230400000,
        value: 1,
        labels: { level: 'error' },
        metadata: { message: 'Test error' }
      },
      {
        timestamp: 1719230460000,
        value: 1,
        labels: { level: 'warn' },
        metadata: { message: 'Test warning' }
      }
    ]
  };

  const mockCsvContent = 'timestamp,level,message\n2025-06-24T10:00:00Z,error,Test error\n2025-06-24T10:01:00Z,warn,Test warning';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_SHEETS_ENABLED = 'true';

    // Mock fs.readFileSync to return mock credentials
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCredentials));
  });

  afterEach(() => {
    delete process.env.GOOGLE_SHEETS_ENABLED;
    delete process.env.GOOGLE_SHEETS_CREDENTIALS;
  });

  describe('constructor', () => {
    it('should create service with file credentials', () => {
      const service = new GoogleSheetsService(mockConfig);
      expect(service).toBeDefined();
      // Credentials are not loaded in constructor anymore
    });

    it('should create service without throwing when no credentials file', () => {
      const configWithoutFile = { ...mockConfig, credentials: undefined };
      // Should not throw in constructor - initialization is lazy
      const service = new GoogleSheetsService(configWithoutFile);
      expect(service).toBeDefined();
    });

    it('should create service without throwing when credentials file is invalid', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Should not throw in constructor - initialization is lazy
      const service = new GoogleSheetsService(mockConfig);
      expect(service).toBeDefined();
    });
  });

  describe('appendData', () => {
    let service: GoogleSheetsService;

    beforeEach(() => {
      service = new GoogleSheetsService(mockConfig);
    });

    it('should skip when Google Sheets is disabled', async () => {
      delete process.env.GOOGLE_SHEETS_ENABLED;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.appendData(mockAggregatedData, mockCsvContent);

      expect(consoleSpy).toHaveBeenCalledWith(
        '  📋 Google Sheets integration disabled (set GOOGLE_SHEETS_ENABLED=true to enable)'
      );
      consoleSpy.mockRestore();
    });

    it('should append data successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, mockCsvContent);

      expect(consoleSpy).toHaveBeenCalledWith('  📋 Uploading to Google Sheets...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully appended'));
      consoleSpy.mockRestore();
    });

    it('should handle empty data', async () => {
      const emptyData = { ...mockAggregatedData, data: [] };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(emptyData, '');

      expect(consoleSpy).toHaveBeenCalledWith('  ⚠️  No data to upload to Google Sheets');
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('API Error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw - errors are handled gracefully
      await service.appendData(mockAggregatedData, mockCsvContent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to upload to Google Sheets: API Error')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should skip headers by default in append mode', async () => {
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, mockCsvContent);

      // Should call append with data excluding headers (first row)
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'TestSheet!A1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            ['2025-06-24T10:00:00Z', 'error', 'Test error'],
            ['2025-06-24T10:01:00Z', 'warn', 'Test warning']
          ]
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully appended 2 rows to Google Sheets (headers skipped)')
      );
      consoleSpy.mockRestore();
    });

    it('should include headers when includeHeadersOnAppend is true', async () => {
      const configWithHeaders = { ...mockConfig, includeHeadersOnAppend: true };
      const serviceWithHeaders = new GoogleSheetsService(configWithHeaders);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await serviceWithHeaders.appendData(mockAggregatedData, mockCsvContent);

      // Should call append with all data including headers
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'TestSheet!A1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            ['timestamp', 'level', 'message'],
            ['2025-06-24T10:00:00Z', 'error', 'Test error'],
            ['2025-06-24T10:01:00Z', 'warn', 'Test warning']
          ]
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully appended 3 rows to Google Sheets')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('headers skipped')
      );
      consoleSpy.mockRestore();
    });

    it('should include headers in overwrite mode regardless of includeHeadersOnAppend setting', async () => {
      const configOverwrite = { ...mockConfig, appendMode: false, includeHeadersOnAppend: false };
      const serviceOverwrite = new GoogleSheetsService(configOverwrite);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await serviceOverwrite.appendData(mockAggregatedData, mockCsvContent);

      // Should call update with all data including headers in overwrite mode
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'TestSheet!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['timestamp', 'level', 'message'],
            ['2025-06-24T10:00:00Z', 'error', 'Test error'],
            ['2025-06-24T10:01:00Z', 'warn', 'Test warning']
          ]
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('  ✅ Successfully updated 3 rows in Google Sheets');
      consoleSpy.mockRestore();
    });
  });

  describe('parseCsvData', () => {
    let service: GoogleSheetsService;

    beforeEach(() => {
      service = new GoogleSheetsService(mockConfig);
    });

    it('should parse simple CSV correctly', () => {
      const csvContent = 'name,age,city\nJohn,30,New York\nJane,25,London';
      const result = (service as any).parseCsvData(csvContent);

      expect(result).toEqual([
        ['name', 'age', 'city'],
        ['John', '30', 'New York'],
        ['Jane', '25', 'London']
      ]);
    });

    it('should handle quoted fields with commas', () => {
      const csvContent = 'name,message\nJohn,"Hello, World"\nJane,"Error: something, happened"';
      const result = (service as any).parseCsvData(csvContent);

      expect(result).toEqual([
        ['name', 'message'],
        ['John', 'Hello, World'],
        ['Jane', 'Error: something, happened']
      ]);
    });

    it('should handle empty lines', () => {
      const csvContent = 'name,age\n\nJohn,30\n\nJane,25\n';
      const result = (service as any).parseCsvData(csvContent);

      expect(result).toEqual([
        ['name', 'age'],
        ['John', '30'],
        ['Jane', '25']
      ]);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', async () => {
      mockFs.existsSync.mockReturnValue(true);
      const service = new GoogleSheetsService(mockConfig);
      // Initialize the service first to load credentials
      await (service as any).initialize();
      expect(() => (service as any).validateConfiguration()).not.toThrow();
    });

    it('should throw error for missing spreadsheet ID', () => {
      const invalidConfig = { ...mockConfig, spreadsheetId: '' };
      const service = new GoogleSheetsService(invalidConfig);

      expect(() => (service as any).validateConfiguration()).toThrow(ConfigurationError);
    });

    it('should throw error for invalid spreadsheet ID format', () => {
      const invalidConfig = { ...mockConfig, spreadsheetId: 'invalid-id' };
      const service = new GoogleSheetsService(invalidConfig);

      expect(() => (service as any).validateConfiguration()).toThrow(ConfigurationError);
    });
  });

  describe('getSheetUrl', () => {
    let service: GoogleSheetsService;

    beforeEach(() => {
      service = new GoogleSheetsService(mockConfig);
    });

    it('should return basic URL for default sheet', () => {
      const url = service.getSheetUrlSync();
      expect(url).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('should return URL with GID for custom sheet', async () => {
      const url = await service.getSheetUrl();
      expect(url).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms#gid=123456789');
    });
  });

  describe('createSheetIfNotExists', () => {
    let service: GoogleSheetsService;

    beforeEach(() => {
      service = new GoogleSheetsService(mockConfig);
    });

    it('should not create sheet if it already exists', async () => {
      const { google } = require('googleapis');
      const mockSheets = google.sheets();

      await service.createSheetIfNotExists('TestSheet');

      expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should create sheet if it does not exist', async () => {
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.createSheetIfNotExists('NewSheet');

      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'NewSheet'
              }
            }
          }]
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('  📄 Created new sheet: NewSheet');
      consoleSpy.mockRestore();
    });
  });

  describe('canInitialize', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      process.env.GOOGLE_SHEETS_ENABLED = 'true';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCredentials));
    });

    afterEach(() => {
      delete process.env.GOOGLE_SHEETS_ENABLED;
      delete process.env.GOOGLE_SHEETS_CREDENTIALS;
    });

    it('should return false when Google Sheets is disabled', () => {
      delete process.env.GOOGLE_SHEETS_ENABLED;
      const result = GoogleSheetsService.canInitialize(mockConfig);
      expect(result).toBe(false);
    });

    it('should return false when no spreadsheet ID', () => {
      const configWithoutId = { ...mockConfig, spreadsheetId: '' };
      const result = GoogleSheetsService.canInitialize(configWithoutId);
      expect(result).toBe(false);
    });

    it('should return true when credentials file exists and is valid', () => {
      const result = GoogleSheetsService.canInitialize(mockConfig);
      expect(result).toBe(true);
    });

    it('should return false when credentials file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = GoogleSheetsService.canInitialize(mockConfig);
      expect(result).toBe(false);
    });

    it('should return false when credentials file is invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      const result = GoogleSheetsService.canInitialize(mockConfig);
      expect(result).toBe(false);
    });

    it('should return true when using environment credentials', () => {
      const configWithoutFile = { ...mockConfig, credentials: undefined };
      process.env.GOOGLE_SHEETS_CREDENTIALS = JSON.stringify(mockCredentials);

      const result = GoogleSheetsService.canInitialize(configWithoutFile);
      expect(result).toBe(true);
    });

    it('should return false when environment credentials are invalid JSON', () => {
      const configWithoutFile = { ...mockConfig, credentials: undefined };
      process.env.GOOGLE_SHEETS_CREDENTIALS = 'invalid json';

      const result = GoogleSheetsService.canInitialize(configWithoutFile);
      expect(result).toBe(false);
    });
  });

  describe('escapeSheetName', () => {
    let service: GoogleSheetsService;

    beforeEach(() => {
      service = new GoogleSheetsService(mockConfig);
    });

    it('should not escape simple sheet names', () => {
      const result = (service as any).escapeSheetName('SimpleSheet');
      expect(result).toBe('SimpleSheet');
    });

    it('should escape sheet names with spaces', () => {
      const result = (service as any).escapeSheetName('Sheet with Spaces');
      expect(result).toBe("'Sheet with Spaces'");
    });

    it('should escape sheet names with special characters', () => {
      const result = (service as any).escapeSheetName("Sheet's Name!");
      expect(result).toBe("'Sheet''s Name!'");
    });

    it('should escape sheet names starting with numbers', () => {
      const result = (service as any).escapeSheetName('2025 Data');
      expect(result).toBe("'2025 Data'");
    });

    it('should handle single quotes correctly', () => {
      const result = (service as any).escapeSheetName("John's Data");
      expect(result).toBe("'John''s Data'");
    });
  });

  describe('sheet name handling in appendData', () => {
    it('should use escaped sheet name in range for names with spaces', async () => {
      const configWithSpaces = { ...mockConfig, sheetName: 'Test Data Sheet' };
      const service = new GoogleSheetsService(configWithSpaces);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, mockCsvContent);

      // Should use escaped sheet name in range
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
        expect.objectContaining({
          range: "'Test Data Sheet'!A1"
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith('     Sheet: Test Data Sheet');
      expect(consoleSpy).toHaveBeenCalledWith("     Escaped sheet name: 'Test Data Sheet'");
      consoleSpy.mockRestore();
    });

    it('should handle custom range with sheet name override', async () => {
      const configWithRange = {
        ...mockConfig,
        sheetName: 'Data Sheet',
        range: "'Custom Sheet'!B2:Z100"
      };
      const service = new GoogleSheetsService(configWithRange);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();

      await service.appendData(mockAggregatedData, mockCsvContent);

      // Should use the provided range as-is when it contains sheet name
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
        expect.objectContaining({
          range: "'Custom Sheet'!B2:Z100"
        })
      );
    });

    it('should prepend sheet name to range when range does not contain sheet', async () => {
      const configWithRange = {
        ...mockConfig,
        sheetName: 'Data Sheet',
        range: "B2:Z100"
      };
      const service = new GoogleSheetsService(configWithRange);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();

      await service.appendData(mockAggregatedData, mockCsvContent);

      // Should prepend escaped sheet name to range
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
        expect.objectContaining({
          range: "'Data Sheet'!B2:Z100"
        })
      );
    });
  });

  describe('data truncation', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCredentials));
      process.env.GOOGLE_SHEETS_ENABLED = 'true';
    });

    afterEach(() => {
      delete process.env.GOOGLE_SHEETS_ENABLED;
      jest.clearAllMocks();
    });

    it('should truncate cells that exceed the limit', async () => {
      const longText = 'A'.repeat(60000); // Text longer than 50k characters
      const csvWithLongText = `timestamp,message\n2024-01-01T00:00:00Z,"${longText}"`;

      const configWithTruncate = {
        ...mockConfig,
        truncateLimit: 1000,
        truncateSuffix: '...[TRUNCATED]'
      };
      const service = new GoogleSheetsService(configWithTruncate);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, csvWithLongText);

      // Should show truncation message
      expect(consoleSpy).toHaveBeenCalledWith('  ✂️  Truncated 1 cells that exceeded 1000 characters');

      // Should call sheets API with truncated data
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
      const callArgs = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const values = callArgs.requestBody.values;
      expect(values).toBeDefined();
      expect(values.length).toBeGreaterThan(0);
      const truncatedValue = values[0][1]; // First row, second column (headers are skipped in append mode)
      expect(truncatedValue.length).toBe(1000);
      expect(truncatedValue.endsWith('...[TRUNCATED]')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should use default truncation settings when not configured', async () => {
      const longText = 'B'.repeat(60000);
      const csvWithLongText = `timestamp,message\n2024-01-01T00:00:00Z,"${longText}"`;

      const service = new GoogleSheetsService(mockConfig); // No truncation config
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, csvWithLongText);

      // Should use default limit of 49000 and default suffix
      expect(consoleSpy).toHaveBeenCalledWith('  ✂️  Truncated 1 cells that exceeded 49000 characters');

      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
      const callArgs = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const values = callArgs.requestBody.values;
      expect(values).toBeDefined();
      expect(values.length).toBeGreaterThan(0);
      const truncatedValue = values[0][1]; // First row, second column (headers are skipped in append mode)
      expect(truncatedValue.length).toBe(49000);
      expect(truncatedValue.endsWith('...[truncated]')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should not truncate cells under the limit', async () => {
      const shortText = 'Short message';
      const csvWithShortText = `timestamp,message\n2024-01-01T00:00:00Z,"${shortText}"`;

      const configWithTruncate = {
        ...mockConfig,
        truncateLimit: 1000
      };
      const service = new GoogleSheetsService(configWithTruncate);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, csvWithShortText);

      // Should NOT show truncation message
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Truncated'));

      // Should preserve original text
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
      const callArgs = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const values = callArgs.requestBody.values;
      expect(values).toBeDefined();
      expect(values.length).toBeGreaterThan(0);
      const originalValue = values[0][1]; // First row, second column (headers are skipped in append mode)
      expect(originalValue).toBe(shortText);

      consoleSpy.mockRestore();
    });

    it('should handle multiple truncations in same row', async () => {
      const longText1 = 'A'.repeat(60000);
      const longText2 = 'B'.repeat(60000);
      const csvWithMultipleLongTexts = `col1,col2,col3\n"${longText1}","${longText2}","short"`;

      const configWithTruncate = {
        ...mockConfig,
        truncateLimit: 1000
      };
      const service = new GoogleSheetsService(configWithTruncate);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.appendData(mockAggregatedData, csvWithMultipleLongTexts);

      // Should show truncation count of 2
      expect(consoleSpy).toHaveBeenCalledWith('  ✂️  Truncated 2 cells that exceeded 1000 characters');

      consoleSpy.mockRestore();
    });

    it('should handle custom truncation suffix', async () => {
      const longText = 'C'.repeat(60000);
      const csvWithLongText = `message\n"${longText}"`;
      const customSuffix = ' [VOIR LOGS COMPLETS]';

      const configWithCustomSuffix = {
        ...mockConfig,
        truncateLimit: 500,
        truncateSuffix: customSuffix
      };
      const service = new GoogleSheetsService(configWithCustomSuffix);
      const { google } = require('googleapis');
      const mockSheets = google.sheets();

      await service.appendData(mockAggregatedData, csvWithLongText);

      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
      const callArgs = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const values = callArgs.requestBody.values;
      expect(values).toBeDefined();
      expect(values.length).toBeGreaterThan(0);
      const truncatedValue = values[0][0]; // First row, first column (headers are skipped in append mode)

      expect(truncatedValue.length).toBe(500);
      expect(truncatedValue.endsWith(customSuffix)).toBe(true);
      expect(truncatedValue.substring(0, 500 - customSuffix.length)).toBe('C'.repeat(500 - customSuffix.length));
    });
  });
});
