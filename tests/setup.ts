// Test setup file
// Configure any global test settings here

// Mock console methods in tests to keep output clean
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
