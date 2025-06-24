# Loki & Prometheus Data Extractor

A powerful Node.js TypeScript tool for extracting, aggregating, and exporting data from Loki (logs) and Thanos/Prometheus (metrics) APIs to CSV files. Features advanced aggregation, JSON field extraction, date-based grouping, and flexible data filtering capabilities.

## Features

- **Multi-source support**: Query both Loki (logs) and Thanos/Prometheus (metrics) in a single run
- **JSON field extraction**: Extract nested fields from Loki JSON log messages with transformation support
- **Advanced data filtering**: Filter results with regex, exact match, contains, and other pattern types
- **Date-based grouping**: Group data by formatted timestamps (daily, hourly, weekly, etc.)
- **Per-metric aggregation**: Apply different aggregation functions to different fields
- **Flexible time ranges**: Absolute timestamps or relative expressions (e.g., "now-1h")
- **Advanced aggregation**: sum, avg, min, max, count, percentiles, first, last
- **Per-source outputs**: Each data source can have its own output configuration
- **Customizable CSV columns**: Define exactly which fields to export and their formats
- **🆕 Google Sheets integration**: Export data directly to Google Sheets with automatic sheet creation
- **CLI time overrides**: Override configured time ranges via command line
- **Batch processing**: Process multiple queries efficiently
- **Error handling**: Continue processing even if individual sources fail

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd loki-prometheus-extractor

# Install dependencies
npm install

# Build the TypeScript project
npm run build
```

## Quick Start

1. Create a configuration file (e.g., `config/my-config.json`):
```json
{
  "sources": [
    {
      "type": "loki",
      "name": "app-logs",
      "url": "http://localhost:3100",
      "query": "{app=\"myapp\"}",
      "timeRange": {
        "from": "now-1h",
        "to": "now"
      },
      "output": {
        "format": "csv",
        "filename": "app-logs-{timestamp}.csv",
        "columns": [
          {
            "name": "timestamp",
            "source": "timestamp",
            "format": "date",
            "dateFormat": "yyyy-MM-dd HH:mm:ss"
          },
          {
            "name": "message",
            "source": "value"
          }
        ]
      }
    }
  ]
}
```

2. Run the extractor:
```bash
npm start -- -c config/my-config.json
```

3. Check the output CSV file in the current directory.

### 🆕 Google Sheets Integration

To export directly to Google Sheets, add a `googleSheets` configuration:

```json
{
  "sources": [...],
  "outputs": [{
    "name": "my_export",
    "sources": ["app-logs"],
    "outputPath": "logs/",
    "filename": "data-{timestamp}.csv",
    "googleSheets": {
      "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      "sheetName": "LogData",
      "credentials": "config/google-sheets-credentials.json",
      "appendMode": true
    }
  }]
}
```

Enable Google Sheets integration:
```bash
export GOOGLE_SHEETS_ENABLED=true
npm start -- -c config/my-config.json
```

See the [Google Sheets Quick Start Guide](docs/google-sheets-quickstart.md) for complete setup instructions.

## Project Structure

```
loki-prometheus-extractor/
├── src/
│   ├── index.ts                 # Main entry point and CLI
│   ├── types/
│   │   └── config.types.ts      # TypeScript interfaces
│   ├── clients/
│   │   ├── loki.client.ts       # Loki API client
│   │   └── thanos.client.ts     # Thanos/Prometheus API client
│   ├── aggregators/
│   │   └── data-aggregator.ts   # Data aggregation logic
│   ├── writers/
│   │   └── csv-writer.ts        # CSV output writer
│   └── utils/
│       └── date-utils.ts        # Date formatting utilities
├── config/                      # Example configurations
│   ├── example.json
│   ├── example-date-formats.json
│   └── example-date-aggregation.json
├── examples/                    # More example configurations
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### Basic Usage

```bash
# Run with compiled JavaScript
npm start -- -c config/example-config.json

# Or use TypeScript directly (development)
npm run dev -- -c config/example-config.json

# With custom config file
node dist/index.js -c /path/to/your/config.json
```

### Command Line Options

```bash
Options:
  -V, --version        output the version number
  -c, --config <path>  Path to configuration file (required)
  -f, --from <time>    Override time range start (e.g., "now-1h", "2024-01-01T00:00:00Z")
  -t, --to <time>      Override time range end (e.g., "now", "2024-01-01T23:59:59Z")
  -h, --help           display help for command
```

### Override Time Ranges

You can override the time ranges specified in the configuration file using CLI parameters:

```bash
# Query last 2 hours instead of config time range
npm start -- -c config/example-config.json --from "now-2h" --to "now"

# Query specific date range
npm start -- -c config/example-config.json \
  --from "2024-01-15T00:00:00Z" \
  --to "2024-01-15T23:59:59Z"

# Query last week
npm start -- -c config/example-config.json --from "now-1w" --to "now"

# Query from start of yesterday to now
npm start -- -c config/example-config.json --from "now-1d/d"
```

Note: Time range overrides apply to ALL sources in the configuration.

## Configuration

### Basic Structure

```json
{
  "sources": [
    {
      "type": "loki" | "thanos",
      "name": "unique-source-name",
      "url": "http://api-endpoint",
      "query": "LogQL or PromQL query",
      "timeRange": {
        "from": "start time",
        "to": "end time"
      },
      "aggregation": { /* optional */ },
      "output": { /* optional source-specific output */ }
    }
  ],
  "output": { /* optional global output fallback */ }
}
```

### Time Range Formats

#### Absolute Time
- ISO 8601 format: `"2024-01-01T00:00:00Z"`
- Date strings: `"2024-01-01"`, `"2024/01/01"`

#### Relative Time
- Current time: `"now"`
- Minutes ago: `"now-5m"`, `"now-30m"`
- Hours ago: `"now-1h"`, `"now-24h"`
- Days ago: `"now-1d"`, `"now-7d"`
- Weeks ago: `"now-1w"`, `"now-4w"`

#### Relative Time with Truncation
Truncate to the start of a time period using `/` suffix:
- Start of previous hour: `"now-1h/h"`
- Start of previous day: `"now-1d/d"`
- Start of previous week: `"now-1w/w"` (Monday)
- Start of last week: `"now-7d/w"`

Examples:
- `"now-1w/w"`: Start of the previous week (Monday 00:00:00)
- `"now-2d/d"`: Start of 2 days ago (00:00:00)
- `"now-3h/h"`: Start of 3 hours ago (XX:00:00)

### Aggregation Options

#### Date-based Grouping
Group data by formatted timestamps for time-based aggregation:

```json
{
  "aggregation": {
    "groupBy": [
      {
        "field": "timestamp",
        "dateFormat": "yyyy-MM-dd"  // Daily grouping
      },
      "category"
    ],
    "metrics": [
      {
        "name": "daily_count",
        "function": "count"
      }
    ]
  }
}
```

**Common date formats:**
- `yyyy-MM-dd` - Daily aggregation
- `yyyy-MM-dd HH:00` - Hourly aggregation  
- `yyyy-MM-dd HH:mm` - Minute-level aggregation
- `yyyy-'W'ww` - Weekly aggregation (e.g., "2024-W52")
- `yyyy-MM` - Monthly aggregation
- `yyyy-MM-dd'T'HH:mm:ss` - Full timestamp

#### Advanced Per-Metric Aggregation
```json
{
  "aggregation": {
    "groupBy": ["endpoint", "method"],
    "metrics": [
      {
        "name": "request_count",
        "function": "count"
      },
      {
        "name": "avg_response_time",
        "field": "response_time_ms",
        "function": "avg"
      },
      {
        "name": "last_error",
        "field": "error_message",
        "function": "last"
      },
      {
        "name": "p95_latency",
        "field": "duration",
        "function": "percentile",
        "percentile": 95
      }
    ]
  }
}
```

**Available aggregation functions:**
- `sum` - Sum of all values
- `avg` - Average of all values
- `min` - Minimum value
- `max` - Maximum value
- `count` - Count of data points
- `percentile` - Percentile calculation (requires `percentile` field)
- `last` - Most recent value based on timestamp
- `first` - Earliest value based on timestamp

**Metric Configuration:**
- `name` - Name for the aggregated metric
- `field` - Specific field to aggregate (optional, defaults to main value)
- `function` - Aggregation function to apply
- `percentile` - Percentile value (only for percentile function)

**Timestamp Aggregation:**
You can use min/max functions on the timestamp field to track time ranges:
```json
{
  "metrics": [
    {
      "name": "first_seen",
      "field": "timestamp",
      "function": "min"
    },
    {
      "name": "last_seen",
      "field": "timestamp",
      "function": "max"
    }
  ]
}
```
Then format as dates in the output:
```json
{
  "columns": [
    {
      "name": "first_activity",
      "source": "value.first_seen",
      "format": "date",
      "dateFormat": "yyyy-MM-dd HH:mm:ss"
    }
  ]
}
```

**Combined Metrics Output:**
When using multiple metrics, all values are combined into a single row per group. Access metric values in output columns using `value.{metric_name}`:
```json
{
  "columns": [
    { "name": "endpoint", "source": "labels.endpoint" },
    { "name": "total_requests", "source": "value.request_count" },
    { "name": "avg_response_ms", "source": "value.avg_response_time" },
    { "name": "last_error", "source": "value.last_error" }
  ]
}
```

### Output Configuration

```json
{
  "output": {
    "format": "csv",
    "filename": "path/to/{source}-{timestamp}.csv",
    "columns": [
      {
        "name": "column_name",
        "source": "field.path",
        "format": "date|number|string|json",
        "dateFormat": "yyyy-MM-dd HH:mm:ss"
      }
    ]
  }
}
```

### JSON Field Extraction (Loki)

For Loki sources that return JSON-formatted log messages, you can extract nested fields and use them for grouping and aggregation:

```json
{
  "extractFields": [
    {
      "name": "app_name",
      "path": "details.app.name"
    },
    {
      "name": "error_code",
      "path": "error.code",
      "type": "number"
    },
    {
      "name": "user_id",
      "path": "user.id"
    },
    {
      "name": "span_id",
      "path": "trace.span_id"
    }
  ],
  "aggregation": {
    "groupBy": ["app_name", "error_code"],
    "metrics": [
      {
        "name": "error_count",
        "function": "count"
      },
      {
        "name": "unique_users",
        "field": "user_id",
        "function": "count"
      },
      {
        "name": "last_span_id",
        "field": "span_id",
        "function": "last"
      }
    ]
  }
}
```

This will parse JSON log entries like `{"details": {"app": {"name": "test"}}, "error": {"code": 500}, "user": {"id": "123"}, "trace": {"span_id": "abc123"}}` and extract the specified fields for aggregation.

## Examples

### 1. Daily Error Summary with JSON Field Extraction

```json
{
  "sources": [
    {
      "type": "loki",
      "name": "daily-errors",
      "url": "http://localhost:3100",
      "query": "{app=\"api\"} |= \"error\"",
      "timeRange": {
        "from": "now-7d",
        "to": "now"
      },
      "extractFields": [
        {
          "name": "error_type",
          "path": "error.type"
        },
        {
          "name": "severity",
          "path": "level"
        }
      ],
      "aggregation": {
        "groupBy": [
          {
            "field": "timestamp",
            "dateFormat": "yyyy-MM-dd"
          },
          "error_type",
          "severity"
        ],
        "metrics": [
          {
            "name": "error_count",
            "function": "count"
          },
          {
            "name": "first_occurrence",
            "field": "timestamp",
            "function": "min"
          },
          {
            "name": "last_occurrence", 
            "field": "timestamp",
            "function": "max"
          }
        ]
      },
      "output": {
        "format": "csv",
        "filename": "daily-errors-{timestamp}.csv",
        "columns": [
          {
            "name": "date",
            "source": "labels.timestamp_formatted"
          },
          {
            "name": "error_type",
            "source": "labels.error_type"
          },
          {
            "name": "severity",
            "source": "labels.severity"
          },
          {
            "name": "count",
            "source": "value.error_count",
            "format": "number"
          },
          {
            "name": "first_seen",
            "source": "value.first_occurrence",
            "format": "date",
            "dateFormat": "HH:mm:ss"
          },
          {
            "name": "last_seen",
            "source": "value.last_occurrence",
            "format": "date",
            "dateFormat": "HH:mm:ss"
          }
        ]
      }
    }
  ]
}
```

### 2. Hourly HTTP Traffic Analysis

```json
{
  "sources": [
    {
      "type": "thanos",
      "name": "hourly-traffic",
      "url": "http://localhost:9090",
      "query": "sum(rate(http_requests_total[5m])) by (status, method)",
      "timeRange": {
        "from": "now-24h",
        "to": "now"
      },
      "aggregation": {
        "groupBy": [
          {
            "field": "timestamp",
            "dateFormat": "yyyy-MM-dd HH:00"
          },
          "status",
          "method"
        ],
        "metrics": [
          {
            "name": "avg_requests_per_sec",
            "function": "avg"
          },
          {
            "name": "max_requests_per_sec",
            "function": "max"
          },
          {
            "name": "p95_requests_per_sec",
            "function": "percentile",
            "percentile": 95
          },
          {
            "name": "sample_count",
            "function": "count"
          }
        ]
      },
      "output": {
        "format": "csv",
        "filename": "hourly-traffic-{timestamp}.csv",
        "columns": [
          {
            "name": "hour",
            "source": "labels.timestamp_formatted"
          },
          {
            "name": "status_code",
            "source": "labels.status"
          },
          {
            "name": "method",
            "source": "labels.method"
          },
          {
            "name": "avg_rps",
            "source": "value.avg_requests_per_sec",
            "format": "number"
          },
          {
            "name": "peak_rps",
            "source": "value.max_requests_per_sec",
            "format": "number"
          },
          {
            "name": "p95_rps",
            "source": "value.p95_requests_per_sec",
            "format": "number"
          }
        ]
      }
    }
  ]
}
```

### 3. Trace Analysis with Last Values

```json
{
  "sources": [
    {
      "type": "loki",
      "name": "trace-analysis",
      "url": "http://localhost:3100", 
      "query": "{service=\"checkout\"} |~ \"trace_id\"",
      "timeRange": {
        "from": "now-1h",
        "to": "now"
      },
      "extractFields": [
        {
          "name": "trace_id",
          "path": "trace.id"
        },
        {
          "name": "span_id",
          "path": "trace.span_id"
        },
        {
          "name": "operation",
          "path": "operation"
        },
        {
          "name": "duration_ms",
          "path": "duration",
          "type": "number"
        }
      ],
      "aggregation": {
        "groupBy": ["trace_id", "operation"],
        "metrics": [
          {
            "name": "span_count",
            "function": "count"
          },
          {
            "name": "total_duration",
            "field": "duration_ms",
            "function": "sum"
          },
          {
            "name": "last_span_id",
            "field": "span_id",
            "function": "last"
          },
          {
            "name": "max_duration",
            "field": "duration_ms",
            "function": "max"
          }
        ]
      },
      "output": {
        "format": "csv",
        "filename": "traces-{timestamp}.csv",
        "columns": [
          {
            "name": "trace_id",
            "source": "labels.trace_id"
          },
          {
            "name": "operation",
            "source": "labels.operation"
          },
          {
            "name": "spans",
            "source": "value.span_count"
          },
          {
            "name": "total_ms",
            "source": "value.total_duration"
          },
          {
            "name": "max_ms",
            "source": "value.max_duration"
          },
          {
            "name": "last_span",
            "source": "value.last_span_id"
          }
        ]
      }
    }
  ]
}
```

## Output Files

The tool generates CSV files with customizable naming patterns:

- `{source}`: Replaced with the source name
- `{timestamp}`: Replaced with the current ISO timestamp

Example outputs:
- `logs/errors-app-errors-2024-01-15T10-30-00.csv`
- `metrics/http-requests-2024-01-15T10-30-00.csv`

## Column Formats

- **date**: Converts timestamps to formatted date strings
- **number**: Ensures numeric formatting
- **string**: Converts to string representation
- **json**: Serializes objects/arrays to JSON strings

## Troubleshooting

### Debug Mode

Enable debug logging to see detailed information about field extraction and aggregation:

```bash
DEBUG=1 npm start -- -c config/example.json
```

### Common Issues

#### Empty columns in CSV output
- **Problem**: Columns show empty values despite data being present
- **Solution**: Check that the `source` path in your column configuration matches the actual data structure. Use debug mode to see the exact structure of aggregated data.

#### Timestamp showing 1970-01-01
- **Problem**: Date columns show epoch time (1970-01-01)
- **Solution**: When using min/max on timestamp fields, ensure you're formatting them properly:
  ```json
  {
    "name": "first_seen",
    "source": "value.first_occurrence",
    "format": "date",
    "dateFormat": "yyyy-MM-dd HH:mm:ss"
  }
  ```

#### Count showing 0 with extracted fields
- **Problem**: Count metric shows 0 but other metrics have values
- **Solution**: The `count` function counts all items when no field is specified. For counting specific fields:
  ```json
  {
    "name": "unique_users",
    "field": "user_id",
    "function": "count"
  }
  ```

#### ENOENT: no such file or directory
- **Problem**: Error when writing CSV files
- **Solution**: The tool automatically creates directories. If you still get this error, check file permissions.

#### Loki timestamp format issues
- **Problem**: Timestamps appear as large numbers (nanoseconds)
- **Solution**: The tool automatically converts Loki nanosecond timestamps to milliseconds. If you see raw values, ensure you're using the latest version.

### Type Checking

Run TypeScript type checking to catch configuration errors:

```bash
npm run typecheck
```

## Environment Variables

- `DEBUG=1`: Enable debug logging
- `FAIL_ON_ERROR=true`: Stop processing if any source fails (default: continue)
- `GOOGLE_SHEETS_ENABLED=true`: Enable Google Sheets integration

## Development

```bash
# Run TypeScript compiler in watch mode
npm run build -- --watch

# Run linter
npm run lint

# Type checking
npm run typecheck

# Development mode (auto-recompile)
npm run dev -- -c config/example.json
```

## API Compatibility

- **Loki**: Compatible with Loki v2.x API
- **Thanos/Prometheus**: Compatible with Prometheus v2.x API

## Error Handling

By default, the tool continues processing remaining sources if one fails. Failed sources are logged to the console with error details. Use `FAIL_ON_ERROR=true` to stop on first error.

## License

MIT