import { QueryResult, AggregationConfig, MetricConfig, GroupByConfig } from '../types/config.types';
import { formatDate } from '../utils/date-utils';

export class DataAggregator {
  aggregate(data: QueryResult[], config?: AggregationConfig): QueryResult[] {
    if (!config) {
      return data;
    }

    if (config.groupBy && config.groupBy.length > 0) {
      return this.groupAndAggregate(data, config);
    }

    if (config.function) {
      return this.applyAggregationFunction(data, config.function, config.percentile);
    }

    return data;
  }

  private groupAndAggregate(data: QueryResult[], config: AggregationConfig): QueryResult[] {
    const grouped = new Map<string, QueryResult[]>();

    for (const item of data) {
      const key = this.generateGroupKey(item, config.groupBy!);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    const results: QueryResult[] = [];

    for (const [, group] of grouped) {
      const aggregated = this.aggregateGroup(group, config);
      results.push(...aggregated);
    }

    return results;
  }

  private generateGroupKey(item: QueryResult, groupBy: (string | GroupByConfig)[]): string {
    const keyParts: string[] = [];

    for (const groupByItem of groupBy) {
      let field: string;
      let dateFormat: string | undefined;

      if (typeof groupByItem === 'string') {
        field = groupByItem;
      } else {
        field = groupByItem.field;
        dateFormat = groupByItem.dateFormat;
      }

      let value: any;

      if (field === 'timestamp') {
        if (dateFormat) {
          // Format the timestamp according to the specified format
          value = formatDate(new Date(item.timestamp), dateFormat);
        } else {
          value = item.timestamp;
        }
        keyParts.push(`${field}:${value}`);
      } else if (item.labels && field in item.labels) {
        value = item.labels[field];
        // If this is a timestamp field in labels and dateFormat is specified
        if (dateFormat && typeof value === 'number') {
          value = formatDate(new Date(value), dateFormat);
        }
        keyParts.push(`${field}:${value}`);
      } else if (item.metadata && field in item.metadata) {
        value = item.metadata[field];
        keyParts.push(`${field}:${value}`);
      }
    }

    return keyParts.join('|');
  }

  private aggregateGroup(group: QueryResult[], config: AggregationConfig): QueryResult[] {
    if (!config.metrics || config.metrics.length === 0) {
      // If no metrics specified but function exists, apply to whole group
      if (config.function) {
        const value = this.applyFunction(group, config.function, config.percentile);
        return [this.createAggregatedResultWithGrouping(group, value, config.function, config.groupBy)];
      }
      return group;
    }

    // Collect all metric values
    const metricValues: Record<string, any> = {};
    const timestamps = group.map(g => g.timestamp);

    for (const metric of config.metrics) {
      if (typeof metric === 'string') {
        // Legacy string format
        switch (metric) {
          case 'count':
            metricValues[metric] = group.length;
            break;
          case 'rate':
            const sorted = group.sort((a, b) => a.timestamp - b.timestamp);
            const timespan = (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 1000;
            metricValues[metric] = group.length / timespan;
            break;
          default:
            if (config.function) {
              metricValues[metric] = this.applyFunction(group, config.function, config.percentile);
            }
        }
      } else {
        // New MetricConfig format
        const metricConfig = metric as MetricConfig;
        let dataToAggregate = group;

        // If field is specified, filter/transform data to focus on that field
        if (metricConfig.field) {
          dataToAggregate = group.map(item => ({
            ...item,
            value: this.extractFieldValue(item, metricConfig.field!)
          })).filter(item => item.value !== undefined);

          // For count function on a specific field, count how many have that field
          if (metricConfig.function === 'count') {
            metricValues[metricConfig.name] = dataToAggregate.length;
          } else {
            const value = this.applyFunction(dataToAggregate, metricConfig.function, metricConfig.percentile);
            metricValues[metricConfig.name] = value;
          }
        } else {
          // No field specified - apply function to whole group
          if (metricConfig.function === 'count') {
            metricValues[metricConfig.name] = group.length;
          } else {
            const value = this.applyFunction(group, metricConfig.function, metricConfig.percentile);
            metricValues[metricConfig.name] = value;
          }
        }
      }
    }

    // Create a single result with all metrics
    const first = group[0];

    // Extract group values including formatted dates
    const groupLabels = { ...first.labels };
    if (config.groupBy) {
      for (const groupByItem of config.groupBy) {
        let field: string;
        let dateFormat: string | undefined;

        if (typeof groupByItem === 'string') {
          field = groupByItem;
        } else {
          field = groupByItem.field;
          dateFormat = groupByItem.dateFormat;
        }

        if (field === 'timestamp' && dateFormat) {
          // Add formatted timestamp to labels
          groupLabels[`${field}_formatted`] = formatDate(new Date(first.timestamp), dateFormat);
        } else if (dateFormat && first.labels && field in first.labels) {
          // Handle other date fields in labels
          const fieldValue = first.labels[field];
          if (typeof fieldValue === 'number') {
            groupLabels[`${field}_formatted`] = formatDate(new Date(fieldValue), dateFormat);
          }
        }
      }
    }

    const result: QueryResult = {
      timestamp: Math.min(...timestamps),
      value: metricValues,  // Store all metrics as an object
      labels: groupLabels,
      metadata: {
        ...first.metadata,
        aggregation: 'multi-metric',
        metrics: metricValues,
        count: group.length,
        minTimestamp: Math.min(...timestamps),
        maxTimestamp: Math.max(...timestamps),
      },
    };

    // Debug logging
    if (process.env.DEBUG) {
      console.log('Aggregation result:', {
        group: first.labels,
        metricValues,
        sampleItem: group[0]
      });
    }

    return [result];
  }

  private extractFieldValue(item: QueryResult, field: string): any {
    // Check in labels first
    if (item.labels && field in item.labels) {
      return item.labels[field];
    }

    // Check in metadata
    if (item.metadata && field in item.metadata) {
      return item.metadata[field];
    }

    // Check in extractedFields if it exists
    if (item.metadata?.extractedFields &&
        typeof item.metadata.extractedFields === 'object' &&
        item.metadata.extractedFields !== null &&
        field in item.metadata.extractedFields) {
      return (item.metadata.extractedFields as Record<string, any>)[field];
    }

    // If field is 'value', return the value itself
    if (field === 'value') {
      return item.value;
    }

    // If field is 'timestamp', return the timestamp
    if (field === 'timestamp') {
      return item.timestamp;
    }

    return undefined;
  }

  private applyAggregationFunction(
    data: QueryResult[],
    func: string,
    percentile?: number
  ): QueryResult[] {
    if (data.length === 0) {
      return [];
    }

    const value = this.applyFunction(data, func, percentile);
    return [this.createAggregatedResult(data, value, func)];
  }

  private applyFunction(data: QueryResult[], func: string, percentile?: number): number | string {
    if (func === 'last' || func === 'first') {
      // For last/first, we need to sort by timestamp
      const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
      if (sorted.length === 0) {
        return '';
      }
      const value = func === 'last' ? sorted[sorted.length - 1].value : sorted[0].value;
      // If value is an object (from aggregated data), return empty string
      if (typeof value === 'object') {
        return '';
      }
      return value;
    }

    const numericValues = data
      .map(d => {
        if (typeof d.value === 'number') return d.value;
        if (typeof d.value === 'string') return parseFloat(d.value);
        return NaN;
      })
      .filter(v => !isNaN(v));

    if (numericValues.length === 0) {
      return 0;
    }

    switch (func) {
      case 'sum':
        return numericValues.reduce((a, b) => a + b, 0);
      case 'avg':
        return numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      case 'min':
        return Math.min(...numericValues);
      case 'max':
        return Math.max(...numericValues);
      case 'count':
        return numericValues.length;
      case 'percentile':
        return this.calculatePercentile(numericValues, percentile || 95);
      default:
        throw new Error(`Unknown aggregation function: ${func}`);
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    if (index === Math.floor(index)) {
      return sorted[index];
    }

    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }


  private createAggregatedResultWithGrouping(
    group: QueryResult[],
    value: number | string,
    aggregationType: string,
    groupBy?: (string | GroupByConfig)[]
  ): QueryResult {
    if (group.length === 0) {
      throw new Error('Cannot create aggregated result from empty group');
    }

    const first = group[0];
    const timestamps = group.map(g => g.timestamp);

    // Extract group values including formatted dates
    const groupLabels: Record<string, any> = { ...first.labels, aggregation: aggregationType };
    if (groupBy) {
      for (const groupByItem of groupBy) {
        let field: string;
        let dateFormat: string | undefined;

        if (typeof groupByItem === 'string') {
          field = groupByItem;
        } else {
          field = groupByItem.field;
          dateFormat = groupByItem.dateFormat;
        }

        if (field === 'timestamp' && dateFormat) {
          // Add formatted timestamp to labels
          groupLabels[`${field}_formatted`] = formatDate(new Date(first.timestamp), dateFormat);
        } else if (dateFormat && first.labels && field in first.labels) {
          // Handle other date fields in labels
          const fieldValue = first.labels[field];
          if (typeof fieldValue === 'number') {
            groupLabels[`${field}_formatted`] = formatDate(new Date(fieldValue), dateFormat);
          }
        }
      }
    }

    return {
      timestamp: Math.min(...timestamps),
      value: value,
      labels: groupLabels,
      metadata: {
        ...first.metadata,
        aggregation: aggregationType,
        count: group.length,
        minTimestamp: Math.min(...timestamps),
        maxTimestamp: Math.max(...timestamps),
      },
    };
  }

  private createAggregatedResult(
    group: QueryResult[],
    value: number | string,
    aggregationType: string
  ): QueryResult {
    if (group.length === 0) {
      throw new Error('Cannot create aggregated result from empty group');
    }

    const first = group[0];
    const timestamps = group.map(g => g.timestamp);

    return {
      timestamp: Math.min(...timestamps),
      value: value,
      labels: { ...first.labels, aggregation: aggregationType },
      metadata: {
        ...first.metadata,
        aggregation: aggregationType,
        count: group.length,
        minTimestamp: Math.min(...timestamps),
        maxTimestamp: Math.max(...timestamps),
      },
    };
  }

  parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown interval unit: ${unit}`);
    }
  }
}