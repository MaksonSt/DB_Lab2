import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { pool } from '../db.js';
import { createFixture, resetFixture } from '../generator/fixture.js';
import { generateReport } from '../generator/reports.js';
import type { MatchReportStore } from '../models.js';
import { ensureIndexes, matchReports, mongoClient } from '../mongo/mongo.js';
import { MongoMatchReportRepository } from '../mongo/MongoMatchReportRepository.js';
import { MatchReportRepository } from '../repositories/MatchReportRepository.js';
import { buildScenarios } from './scenarios.js';

const SIZES = (process.env.BENCH_SIZES ?? '1000,10000,50000').split(',').map(Number);
const RUNS = Number(process.env.BENCH_RUNS ?? 7);
const RESERVE = 1000;
const LOAD_BATCH = 1000;

interface Result {
  size: number;
  scenario: string;
  title: string;
  ops: number;
  postgres: number;
  mongo: number;
}

interface StorageSize {
  size: number;
  postgresMb: number;
  mongoMb: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value: number) => Math.round(value * 100) / 100;

async function storage(size: number): Promise<StorageSize> {
  await mongoClient.db('admin').command({ fsync: 1 });
  const pg = await pool.query<{ bytes: string }>(
    `SELECT sum(pg_total_relation_size(t))::BIGINT AS bytes
     FROM unnest(ARRAY['match_reports', 'match_report_periods', 'match_report_events', 'player_match_stats']) t`);
  const [stats] = await matchReports()
    .aggregate<{ storageStats: { storageSize: number; totalIndexSize: number } }>([{ $collStats: { storageStats: {} } }])
    .toArray();
  return {
    size,
    postgresMb: round(Number(pg.rows[0].bytes) / 1048576),
    mongoMb: round((stats.storageStats.storageSize + stats.storageStats.totalIndexSize) / 1048576),
  };
}

function markdown(results: Result[], sizes: StorageSize[]): string {
  const lines = [
    `Медіана з ${RUNS} прогонів після прогріву, мс на серію операцій.`,
    '',
    '| Сценарій | Протоколів у БД | Операцій | PostgreSQL, мс | MongoDB, мс | PG / Mongo |',
    '|---|---:|---:|---:|---:|---:|',
    ...results.map((r) =>
      `| ${r.title} | ${r.size} | ${r.ops} | ${r.postgres} | ${r.mongo} | ${round(r.postgres / r.mongo)} |`),
    '',
    '| Протоколів у БД | PostgreSQL, МБ | MongoDB, МБ |',
    '|---:|---:|---:|',
    ...sizes.map((s) => `| ${s.size} | ${s.postgresMb} | ${s.mongoMb} |`),
  ];
  return lines.join('\n') + '\n';
}

async function main() {
  const maxSize = Math.max(...SIZES);
  await mongoClient.connect();
  const collection = matchReports();
  await collection.drop().catch(() => undefined);
  await ensureIndexes(collection);

  console.log(`Підготовка: ${maxSize + RESERVE} матчів у PostgreSQL...`);
  await resetFixture(pool);
  const fixture = await createFixture(pool, maxSize + RESERVE);
  const reserve = fixture.slots.slice(maxSize).map(generateReport);

  const client = await pool.connect();
  const stores: Record<'postgres' | 'mongo', MatchReportStore> = {
    postgres: new MatchReportRepository(client),
    mongo: new MongoMatchReportRepository(collection),
  };

  const results: Result[] = [];
  const sizes: StorageSize[] = [];
  let loaded = 0;

  try {
    for (const size of SIZES) {
      console.log(`\nЗавантаження до ${size} протоколів...`);
      for (let from = loaded; from < size; from += LOAD_BATCH) {
        const batch = fixture.slots.slice(from, Math.min(size, from + LOAD_BATCH)).map(generateReport);
        await stores.postgres.insertMany(batch);
        await stores.mongo.insertMany(batch);
      }
      loaded = size;
      await client.query('VACUUM ANALYZE');
      sizes.push(await storage(size));

      for (const scenario of buildScenarios(fixture, size, reserve)) {
        const times: Record<'postgres' | 'mongo', number[]> = { postgres: [], mongo: [] };
        for (let run = 0; run <= RUNS; run++) {
          const order: ('postgres' | 'mongo')[] = run % 2 ? ['postgres', 'mongo'] : ['mongo', 'postgres'];
          for (const db of order) {
            const started = performance.now();
            await scenario.run(stores[db]);
            const elapsed = performance.now() - started;
            if (run > 0) times[db].push(elapsed);
            await scenario.cleanup?.(stores[db]);
          }
        }
        const result: Result = {
          size,
          scenario: scenario.name,
          title: scenario.title,
          ops: scenario.ops,
          postgres: round(median(times.postgres)),
          mongo: round(median(times.mongo)),
        };
        results.push(result);
        console.log(`${scenario.name.padEnd(18)} PG ${String(result.postgres).padStart(9)} мс | Mongo ${String(result.mongo).padStart(9)} мс`);
      }

      const event = fixture.events[0].id;
      const pgTop = await stores.postgres.topPlayers(event, 'goals', 10);
      const mongoTop = await stores.mongo.topPlayers(event, 'goals', 10);
      const consistent = JSON.stringify(pgTop.map((p) => [p.athleteId, p.total])) ===
        JSON.stringify(mongoTop.map((p) => [p.athleteId, p.total]));
      console.log(`Перевірка: результати агрегації в обох БД ${consistent ? 'збігаються' : 'НЕ збігаються'}`);
    }
  } finally {
    client.release();
  }

  await mkdir(new URL('../../../results/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../../results/benchmark.json', import.meta.url), JSON.stringify({ runs: RUNS, results, sizes }, null, 2));
  await writeFile(new URL('../../../results/benchmark.md', import.meta.url), markdown(results, sizes));
  console.log('\nРезультати: results/benchmark.md, results/benchmark.json');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([pool.end(), mongoClient.close()]));
