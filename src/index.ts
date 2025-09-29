import { Command } from 'commander';
import * as fs from 'fs';
import Joi from 'joi';
import { Config, AggregatedData } from './types/config.types';
import { LokiClient } from './clients/loki.client';
import { ThanosClient } from './clients/thanos.client';
import { DataAggregator } from './aggregators/data-aggregator';
import { CsvWriter } from './writers/csv-writer';
import { AGGREGATION_FUNCTIONS, TRANSFORM_TYPES } from './constants/app.constants';

const outputSchema = Joi.object({
  format: Joi.string().valid('csv').required(),
  filename: Joi.string().required(),
  columns: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      source: Joi.string().required(),
      format: Joi.string().valid('json', 'string', 'number', 'date').optional(),
      dateFormat: Joi.string().optional(),
    })
  ).min(1).required(),
  delimiter: Joi.string().optional(),
  includeHeaders: Joi.boolean().optional(),
  googleSheets: Joi.object({
    spreadsheetId: Joi.string().required(),
    sheetName: Joi.string().optional(),
    credentials: Joi.string().optional(),
    range: Joi.string().optional(),
    appendMode: Joi.boolean().optional(),
    includeHeadersOnAppend: Joi.boolean().optional(),
    truncateLimit: Joi.number().min(1000).max(50000).optional(),
    truncateSuffix: Joi.string().max(100).optional(),
  }).optional(),
});

const configSchema = Joi.object({
  sources: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('loki', 'thanos').required(),
      name: Joi.string().required(),
      url: Joi.string().uri().required(),
      query: Joi.string().required(),
      timeRange: Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
      }).required(),
      aggregation: Joi.object({
        groupBy: Joi.array().items(
          Joi.alternatives().try(
            Joi.string(),
            Joi.object({
              field: Joi.string().required(),
              dateFormat: Joi.string().optional(),
            })
          )
        ),
        metrics: Joi.array().items(
          Joi.alternatives().try(
            Joi.string(),
            Joi.object({
              name: Joi.string().required(),
              field: Joi.string().optional(),
              function: Joi.string().valid(...AGGREGATION_FUNCTIONS).required(),
              percentile: Joi.number().min(0).max(100).optional(),
            })
          )
        ),
        function: Joi.string().valid(...AGGREGATION_FUNCTIONS),
        interval: Joi.string(),
        percentile: Joi.number().min(0).max(100),
      }).optional(),
      headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
      timeout: Joi.number().positive().optional(),
      output: outputSchema.optional(),
      extractFields: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          path: Joi.string().required(),
          type: Joi.string().valid('string', 'number', 'boolean').optional(),
          format: Joi.string().optional(),
          transform: Joi.string().valid(...TRANSFORM_TYPES).optional(),
        })
      ).optional(),
      filters: Joi.array().items(
        Joi.object({
          field: Joi.string().required(),
          pattern: Joi.string().required(),
          mode: Joi.string().valid('include', 'exclude').required(),
          type: Joi.string().valid('regex', 'exact', 'contains', 'startsWith', 'endsWith').required(),
          caseSensitive: Joi.boolean().optional(),
        })
      ).optional(),
    })
  ).min(1).required(),
  output: outputSchema.optional(),
}).custom((value, helpers) => {
  // Ensure each source has either its own output or a global output exists
  const hasGlobalOutput = value.output !== undefined;
  const sourcesWithoutOutput = value.sources.filter((s: any) => !s.output);

  if (!hasGlobalOutput && sourcesWithoutOutput.length > 0) {
    return helpers.error('any.invalid', {
      message: `Sources without output configuration require a global output config: ${sourcesWithoutOutput.map((s: any) => s.name).join(', ')}`
    });
  }

  return value;
});

async function loadConfig(configPath: string): Promise<Config> {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const { error, value } = configSchema.validate(config);
    if (error) {
      throw new Error(`Invalid configuration: ${error.message}`);
    }

    return value as Config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}

async function processDataSource(source: any, aggregator: DataAggregator): Promise<AggregatedData> {
  console.log(`Processing ${source.type} source: ${source.name}`);
  console.log(`  Time range: ${source.timeRange.from} to ${source.timeRange.to}`);

  let client;
  if (source.type === 'loki') {
    client = new LokiClient(source);
  } else if (source.type === 'thanos') {
    client = new ThanosClient(source);
  } else {
    throw new Error(`Unknown source type: ${source.type}`);
  }

  try {
    const rawData = await client.query();
    console.log(`  Retrieved ${rawData.length} data points`);

    const aggregatedData = aggregator.aggregate(rawData, source.aggregation);
    console.log(`  Aggregated to ${aggregatedData.length} data points`);

    return {
      source: source.name,
      data: aggregatedData,
    };
  } catch (error) {
    console.error(`  Error processing source ${source.name}:`, error);
    throw error;
  }
}

async function main() {
  const program = new Command();

  program
    .name('loki-prometheus-extractor')
    .description('Extract and aggregate data from Loki and Thanos APIs to CSV')
    .version('1.0.0')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-f, --from <time>', 'Override time range start (e.g., "now-1h", "2024-01-01T00:00:00Z")')
    .option('-t, --to <time>', 'Override time range end (e.g., "now", "2024-01-01T23:59:59Z")')
    .parse(process.argv);

  const options = program.opts();

  try {
    console.log('Loading configuration...');
    const config = await loadConfig(options.config);

    // Override time ranges if CLI options provided
    if (options.from || options.to) {
      console.log('Overriding time ranges from CLI parameters...');
      for (const source of config.sources) {
        if (options.from) {
          source.timeRange.from = options.from;
        }
        if (options.to) {
          source.timeRange.to = options.to;
        }
      }
      if (options.from && options.to) {
        console.log(`  Time range: ${options.from} to ${options.to}`);
      } else if (options.from) {
        console.log(`  Start time: ${options.from}`);
      } else {
        console.log(`  End time: ${options.to}`);
      }
    }

    console.log(`Processing ${config.sources.length} data sources...`);
    const aggregator = new DataAggregator();
    const outputFiles: string[] = [];
    let totalDataPoints = 0;

    for (const source of config.sources) {
      try {
        const aggregatedData = await processDataSource(source, aggregator);

        // Use source-specific output config if available, otherwise fall back to global
        const outputConfig = source.output || config.output;
        if (!outputConfig) {
          throw new Error(`No output configuration found for source ${source.name}`);
        }

        const csvWriter = new CsvWriter(outputConfig);
        console.log(`Writing CSV output for ${source.name}...`);
        const outputFile = await csvWriter.write(aggregatedData);
        outputFiles.push(outputFile);
        totalDataPoints += aggregatedData.data.length;

        console.log(`  ✅ Exported to: ${outputFile}`);
        console.log(`  Data points: ${aggregatedData.data.length}`);
      } catch (error) {
        console.error(`Failed to process source ${source.name}:`, error);
        if (process.env.FAIL_ON_ERROR === 'true') {
          throw error;
        }
      }
    }

    if (outputFiles.length === 0) {
      console.error('No data exported from any source');
      process.exit(1);
    }

    console.log('\n✅ Export completed successfully!');
    console.log(`   Files created: ${outputFiles.length}`);
    console.log(`   Total data points: ${totalDataPoints}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}