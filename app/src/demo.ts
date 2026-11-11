import { pool } from './db.js';
import { createFixture, resetFixture, BASKETBALL, FOOTBALL } from './generator/fixture.js';
import { generateReport } from './generator/reports.js';
import type { MatchReport } from './models.js';
import { ensureIndexes, matchReports, mongoClient } from './mongo/mongo.js';
import { MongoMatchReportRepository } from './mongo/MongoMatchReportRepository.js';
import { UnitOfWork } from './UnitOfWork.js';

const ORGANIZER = 2;

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function preview(report: MatchReport) {
  const [home, away] = report.teams;
  return {
    матч: report.matchId,
    спорт: report.sport,
    рахунок: `${home.name} ${home.score}:${away.score} ${away.name}`,
    періоди: report.periods.map((p) => `${p.home}:${p.away}`).join(', '),
    подій: report.timeline.length,
    перша_подія: report.timeline[0],
    гравець: report.playerStats[0],
  };
}

async function main() {
  console.log('\n=== 0. Підготовка: 40 матчів у PostgreSQL, протоколи в обидві бази ===');
  await mongoClient.connect();
  const collection = matchReports();
  await collection.drop().catch(() => undefined);
  await ensureIndexes(collection);
  const mongo = new MongoMatchReportRepository(collection);

  await resetFixture(pool);
  const fixture = await createFixture(pool, 40);
  const reports = fixture.slots.map(generateReport);

  await mongo.insertMany(reports);
  await UnitOfWork.run(pool, ORGANIZER, (uow) => uow.matchReports.insertMany(reports));
  console.log(`MongoDB: ${await collection.countDocuments()} документів`);
  console.log(`PostgreSQL: ${(await pool.query('SELECT count(*)::INT AS n FROM match_reports')).rows[0].n} протоколів, ` +
    `${(await pool.query('SELECT count(*)::INT AS n FROM player_match_stats')).rows[0].n} рядків статистики`);

  console.log('\n=== 1. Структура протоколу залежить від виду спорту (MongoDB) ===');
  const footballId = fixture.slots.find((s) => s.sportId === FOOTBALL)!.matchId;
  const basketballId = fixture.slots.find((s) => s.sportId === BASKETBALL)!.matchId;
  console.dir(preview((await mongo.getByMatchId(footballId))!), { depth: 3 });
  console.dir(preview((await mongo.getByMatchId(basketballId))!), { depth: 3 });

  console.log('\n=== 2. Той самий протокол, зібраний із 5 таблиць PostgreSQL (v_match_reports) ===');
  let equal = 0;
  await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
    for (const slot of fixture.slots) {
      const fromPg = await uow.matchReports.getByMatchId(slot.matchId);
      const fromMongo = await mongo.getByMatchId(slot.matchId);
      if (same(fromPg, fromMongo)) equal++;
    }
  });
  console.log(`Протоколи в обох базах ідентичні: ${equal} з ${fixture.slots.length}`);

  console.log('\n=== 3. Агрегації: найкращі гравці турніру ===');
  const footballEvent = fixture.slots.find((s) => s.sportId === FOOTBALL)!.eventId;
  const basketballEvent = fixture.slots.find((s) => s.sportId === BASKETBALL)!.eventId;
  await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
    console.log(`Бомбардири, подія ${footballEvent}, PostgreSQL / MongoDB:`);
    console.table(await uow.matchReports.topPlayers(footballEvent, 'goals', 3));
    console.table(await mongo.topPlayers(footballEvent, 'goals', 3));
    console.log(`Очки, подія ${basketballEvent}, PostgreSQL / MongoDB:`);
    console.table(await uow.matchReports.topPlayers(basketballEvent, 'points', 3));
    console.table(await mongo.topPlayers(basketballEvent, 'points', 3));
    console.log('Картки по подіях:', same(await uow.matchReports.cardsPerEvent(), await mongo.cardsPerEvent()) ? 'однакові в обох базах' : 'РІЗНІ');
    console.table(await mongo.cardsPerEvent());
  });

  console.log('\n=== 4. Оновлення: гол на 90+3 хвилині ===');
  const report = (await mongo.getByMatchId(footballId))!;
  const scorer = report.playerStats.find((p) => p.teamId === report.teams[0].teamId)!;
  const goal = { period: 2, minute: 93, type: 'goal' as const, teamId: scorer.teamId, athleteId: scorer.athleteId, note: 'header' };
  await mongo.addEvent(footballId, goal, 'goals');
  await UnitOfWork.run(pool, ORGANIZER, (uow) => uow.matchReports.addEvent(footballId, goal, 'goals'));
  await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
    const fromPg = (await uow.matchReports.getByMatchId(footballId))!;
    const fromMongo = (await mongo.getByMatchId(footballId))!;
    const goalsOf = (r: MatchReport) => r.playerStats.find((p) => p.athleteId === scorer.athleteId)!.stats.goals;
    console.log(`${scorer.name}: голів до ${scorer.stats.goals}, після PostgreSQL ${goalsOf(fromPg)}, MongoDB ${goalsOf(fromMongo)}`);
    console.log('Остання подія:', fromPg.timeline.at(-1));
    console.log('Протоколи після оновлення ідентичні:', same(fromPg, fromMongo) ? 'так' : 'ні');
  });

  console.log('\n=== 5. Unit of Work: помилка -> ROLLBACK (PostgreSQL) ===');
  try {
    await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
      await uow.matchReports.addEvent(footballId, { ...goal, minute: 94 }, 'goals');
      await uow.matchReports.setAttendance(-1, 100);
    });
  } catch (error) {
    console.log('Помилка з БД:', (error as Error).message);
  }
  await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
    const events = (await uow.matchReports.getByMatchId(footballId))!.timeline.length;
    console.log(`Подій у протоколі: ${events} (гол на 94 хв скасовано)`);
  });

  console.log('\n=== 6. Гнучкість схеми проти цілісності ===');
  const odd = generateReport(fixture.slots[1]);
  odd.playerStats[0].stats.dunks = 2;
  await mongo.deleteByMatchIds([odd.matchId]);
  await mongo.insert(odd);
  console.log('MongoDB прийняла новий показник "dunks" без зміни схеми');
  try {
    await UnitOfWork.run(pool, ORGANIZER, async (uow) => {
      await uow.matchReports.deleteByMatchIds([odd.matchId]);
      await uow.matchReports.insert(odd);
    });
  } catch (error) {
    console.log('PostgreSQL відхилила протокол:', (error as Error).message);
    console.log('Новий показник треба спершу додати в stat_definitions');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([pool.end(), mongoClient.close()]));
