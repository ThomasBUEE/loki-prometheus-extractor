# Troubleshooting Guide

## Common Issues

### 1. Empty Metric Values in CSV

If you're seeing empty values for metrics like `last_span_id`, check:

1. **Field Extraction**: Ensure the field is being extracted correctly from JSON:
   ```json
   "extractFields": [
     {
       "name": "span_id",
       "path": "span_id"  // or nested path like "trace.span_id"
     }
   ]
   ```

2. **Field Reference in Metrics**: Use the extracted field name (not the path):
   ```json
   "metrics": [
     {
       "name": "last_span_id",
       "field": "span_id",  // Use the name from extractFields
       "function": "last"
     }
   ]
   ```

3. **CSV Column Mapping**: Reference the metric by its name:
   ```json
   "columns": [
     {
       "name": "last_span",
       "source": "value.last_span_id"  // value.{metric_name}
     }
   ]
   ```

### 2. Count Discrepancies

When using field-specific counts, the numbers may differ from total counts:

- `total_count`: Counts all items in the group
- `field_count`: Only counts items where the field exists and is not undefined

Example:
```json
"metrics": [
  {
    "name": "total_count",
    "function": "count"  // Counts all logs
  },
  {
    "name": "span_count",
    "field": "span_id",
    "function": "count"  // Only counts logs with span_id
  }
]
```

### 3. Debugging Tips

1. **Enable Debug Mode**:
   ```bash
   DEBUG=1 npm run dev -- -c config/your-config.json
   ```

2. **Add Debug Column**: Include the raw metrics object to see all values:
   ```json
   {
     "name": "debug_all_metrics",
     "source": "value",
     "format": "json"
   }
   ```

3. **Check Sample Data**: Add a column to see raw labels:
   ```json
   {
     "name": "all_labels",
     "source": "labels",
     "format": "json"
   }
   ```

## Example: Tracing Span IDs

Here's a complete example for extracting and aggregating span IDs from JSON logs:

```json
{
  "sources": [
    {
      "type": "loki",
      "name": "trace-logs",
      "url": "http://localhost:3100",
      "query": "{app=\"myapp\"}",
      "timeRange": {
        "from": "now-1h",
        "to": "now"
      },
      "extractFields": [
        {
          "name": "span_id",
          "path": "traceInfo.spanId"  // Adjust based on your JSON structure
        },
        {
          "name": "trace_id",
          "path": "traceInfo.traceId"
        },
        {
          "name": "service_name",
          "path": "service"
        }
      ],
      "aggregation": {
        "groupBy": ["service_name"],
        "metrics": [
          {
            "name": "total_requests",
            "function": "count"
          },
          {
            "name": "traced_requests",
            "field": "span_id",
            "function": "count"
          },
          {
            "name": "last_span_id",
            "field": "span_id",
            "function": "last"
          },
          {
            "name": "last_trace_id",
            "field": "trace_id",
            "function": "last"
          }
        ]
      },
      "output": {
        "format": "csv",
        "filename": "trace-summary.csv",
        "columns": [
          {
            "name": "service",
            "source": "labels.service_name"
          },
          {
            "name": "total_requests",
            "source": "value.total_requests"
          },
          {
            "name": "traced_requests",
            "source": "value.traced_requests"
          },
          {
            "name": "trace_coverage_percent",
            "source": "value.traced_requests",
            "format": "number"
          },
          {
            "name": "last_span",
            "source": "value.last_span_id"
          },
          {
            "name": "last_trace",
            "source": "value.last_trace_id"
          }
        ]
      }
    }
  ]
}
```

## Understanding Data Flow

1. **Loki Returns**: Raw log lines (often JSON)
2. **Field Extraction**: Parses JSON and extracts specified fields into labels
3. **Grouping**: Groups data by specified labels
4. **Aggregation**: Applies functions to each group
5. **Output**: Combines all metrics into single row per group

## Verifying Field Extraction

To verify fields are being extracted correctly, create a simple config without aggregation:

```json
{
  "sources": [
    {
      "type": "loki",
      "name": "field-test",
      "url": "http://localhost:3100",
      "query": "{app=\"test\"} | head 10",
      "timeRange": {
        "from": "now-5m",
        "to": "now"
      },
      "extractFields": [
        {
          "name": "span_id",
          "path": "span_id"
        }
      ]
    }
  ],
  "output": {
    "format": "csv",
    "filename": "field-test.csv",
    "columns": [
      {
        "name": "timestamp",
        "source": "timestamp",
        "format": "date"
      },
      {
        "name": "raw_log",
        "source": "value"
      },
      {
        "name": "extracted_span_id",
        "source": "labels.span_id"
      },
      {
        "name": "all_labels",
        "source": "labels",
        "format": "json"
      }
    ]
  }
}
```

This will show you exactly what fields are being extracted from your logs.

## Time Range Issues

### 1. Time Override Not Working

If `--from` and `--to` parameters don't seem to work:

1. **Check parameter format**:
   ```bash
   # Correct
   npm start -- -c config.json --from "now-1h" --to "now"
   
   # Incorrect (missing quotes)
   npm start -- -c config.json --from now-1h --to now
   ```

2. **Verify time expressions**:
   ```bash
   # Test with explicit timestamps first
   npm start -- -c config.json \
     --from "2024-01-15T10:00:00Z" \
     --to "2024-01-15T11:00:00Z"
   ```

### 2. No Data Returned

If you get no data with custom time ranges:

1. **Check if data exists in that range**:
   - Try a wider time range first
   - Use Loki/Thanos UI to verify data availability

2. **Time zone issues**:
   - Use UTC timestamps with 'Z' suffix: `2024-01-15T10:00:00Z`
   - Or use relative times: `now-1h`

3. **Query limits**:
   - Some queries may have time range limits
   - Try smaller ranges if large ranges fail

### 3. Debugging Time Ranges

Add a debug source to see exact time ranges being used:

```json
{
  "sources": [
    {
      "type": "loki",
      "name": "time-debug",
      "url": "http://localhost:3100",
      "query": "{app=\"test\"} | head 1",
      "timeRange": {
        "from": "now-5m",
        "to": "now"
      }
    }
  ]
}
```

Run with time override and check console output:
```bash
npm start -- -c debug.json --from "now-1h" --to "now"
# Should show: "Time range: now-1h to now"
```