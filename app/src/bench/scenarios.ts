import type { Fixture } from '../generator/fixture.js';
import { FOOTBALL } from '../generator/fixture.js';
import { Random } from '../generator/random.js';
import { generateReport } from '../generator/reports.js';
import type { MatchReport, MatchReportStore, TimelineEntry } from '../models.js';

export interface Scenario {
  name: string;
  title: string;
  ops: number;
  run(store: MatchReportStore): Promise<void>;
  cleanup?(store: MatchReportStore): Promise<void>;
}

export function buildScenarios(fixture: Fixture, size: number, reserve: MatchReport[]): Scenario[] {
  const random = new Random(size);
  const loaded = fixture.slots.slice(0, size);
  const sample = (n: number) => Array.from({ length: n }, () => random.pick(loaded));

  const single = reserve.slice(0, 100);
  const readIds = sample(200).map((s) => s.matchId);
  const athletes = fixture.teams.flatMap((t) => t.athletes);
  const athleteIds = Array.from({ length: 50 }, () => random.pick(athletes).id);
  const attendance = sample(200).map((s) => ({ matchId: s.matchId, value: random.int(500, 45000) }));

  const updates = sample(200).map((slot) => {
    const report = generateReport(slot);
    const player = random.pick(report.playerStats);
    const football = slot.sportId === FOOTBALL;
    const entry: TimelineEntry = {
      period: football ? 2 : 4,
      minute: football ? 88 : 47,
      type: football ? 'yellow_card' : 'foul',
      teamId: player.teamId,
      athleteId: player.athleteId,
    };
    return { matchId: slot.matchId, entry };
  });

  const deleteReserve = (reports: MatchReport[]) => (store: MatchReportStore) =>
    store.deleteByMatchIds(reports.map((r) => r.matchId));

  return [
    {
      name: 'insert_one',
      title: 'Вставка протоколів по одному',
      ops: single.length,
      async run(store) {
        for (const report of single) await store.insert(report);
      },
      cleanup: deleteReserve(single),
    },
    {
      name: 'insert_bulk',
      title: 'Пакетна вставка протоколів',
      ops: reserve.length,
      run: (store) => store.insertMany(reserve),
      cleanup: deleteReserve(reserve),
    },
    {
      name: 'read_full',
      title: 'Читання цілого протоколу за matchId',
      ops: readIds.length,
      async run(store) {
        for (const id of readIds) await store.getByMatchId(id);
      },
    },
    {
      name: 'read_filter',
      title: 'Матчі події з певним типом події в хронології',
      ops: fixture.events.length,
      async run(store) {
        for (const event of fixture.events) {
          await store.findMatchesWith(event.id, event.sportId === FOOTBALL ? 'red_card' : 'buzzer_beater');
        }
      },
    },
    {
      name: 'agg_top_players',
      title: 'Топ-10 гравців події (голи / очки)',
      ops: fixture.events.length,
      async run(store) {
        for (const event of fixture.events) {
          await store.topPlayers(event.id, event.sportId === FOOTBALL ? 'goals' : 'points', 10);
        }
      },
    },
    {
      name: 'agg_athlete',
      title: 'Середні показники спортсмена за всі матчі',
      ops: athleteIds.length,
      async run(store) {
        for (const id of athleteIds) await store.athleteAverages(id);
      },
    },
    {
      name: 'agg_cards',
      title: 'Картки по всіх подіях (повний прохід)',
      ops: 3,
      async run(store) {
        for (let i = 0; i < 3; i++) await store.cardsPerEvent();
      },
    },
    {
      name: 'update_add_event',
      title: 'Додати подію в хронологію + показник гравця',
      ops: updates.length,
      async run(store) {
        for (const u of updates) await store.addEvent(u.matchId, u.entry, 'fouls');
      },
    },
    {
      name: 'update_attendance',
      title: 'Оновити поле заголовка (відвідуваність)',
      ops: attendance.length,
      async run(store) {
        for (const a of attendance) await store.setAttendance(a.matchId, a.value);
      },
    },
  ];
}
