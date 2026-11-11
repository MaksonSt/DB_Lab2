import type { Pool } from 'pg';
import { Random } from './random.js';
import { generateReport } from './reports.js';

export const FOOTBALL = 1;
export const BASKETBALL = 2;

export const SPORTS: Record<number, { name: string; roster: number; city: string; prefix: string }> = {
  [FOOTBALL]: { name: 'Футбол', roster: 18, city: 'Київ', prefix: 'ФК' },
  [BASKETBALL]: { name: 'Баскетбол', roster: 12, city: 'Львів', prefix: 'БК' },
};

const TEAMS_PER_SPORT = 24;
const EVENTS_PER_SPORT = 10;
const CHUNK = 5000;

const FIRST_NAMES = ['Олег', 'Максим', 'Денис', 'Тарас', 'Віктор', 'Юрій', 'Павло', 'Остап', 'Назар', 'Ігор',
  'Роман', 'Євген', 'Василь', 'Степан', 'Кирило', 'Гліб', 'Марко', 'Данило', 'Олексій', 'Вадим'];
const LAST_NAMES = ['Коваленко', 'Бондаренко', 'Ткачук', 'Мороз', 'Лисенко', 'Гончар', 'Кравець', 'Олійник',
  'Сидоренко', 'Павленко', 'Руденко', 'Марченко', 'Савчук', 'Грищенко', 'Яковенко', 'Зінченко', 'Шевчук',
  'Левченко', 'Онищенко', 'Костенко'];

export interface FixtureAthlete {
  id: number;
  name: string;
}

export interface FixtureTeam {
  id: number;
  name: string;
  sportId: number;
  athletes: FixtureAthlete[];
}

export interface FixtureEvent {
  id: number;
  sportId: number;
}

export interface MatchSlot {
  matchId: number;
  eventId: number;
  sportId: number;
  playedAt: Date;
  home: FixtureTeam;
  away: FixtureTeam;
  seed: number;
}

export interface Fixture {
  events: FixtureEvent[];
  teams: FixtureTeam[];
  slots: MatchSlot[];
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export async function resetFixture(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE match_report_periods, match_report_events, player_match_stats, match_reports');
  await pool.query(`DELETE FROM match_participants WHERE match_id IN
                      (SELECT m.id FROM matches m JOIN events e ON e.id = m.event_id WHERE e.name LIKE 'Ген. %')`);
  await pool.query(`DELETE FROM matches WHERE event_id IN (SELECT id FROM events WHERE name LIKE 'Ген. %')`);
  await pool.query(`DELETE FROM events WHERE name LIKE 'Ген. %'`);
  await pool.query(`DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE coach_name = 'Генератор')`);
  await pool.query(`DELETE FROM athletes WHERE email LIKE '%@gen.local'`);
  await pool.query(`DELETE FROM teams WHERE coach_name = 'Генератор'`);
}

async function createTeams(pool: Pool, random: Random): Promise<FixtureTeam[]> {
  const teams: FixtureTeam[] = [];
  for (const sportId of [FOOTBALL, BASKETBALL]) {
    const sport = SPORTS[sportId];
    const names = Array.from({ length: TEAMS_PER_SPORT }, (_, i) => `${sport.prefix} Ген-${String(i + 1).padStart(2, '0')}`);
    const result = await pool.query<{ id: number; name: string }>(
      `INSERT INTO teams (sport_id, name, city, coach_name)
       SELECT $1, n, $3, 'Генератор' FROM unnest($2::text[]) n
       RETURNING id, name`,
      [sportId, names, sport.city],
    );
    for (const row of result.rows) teams.push({ id: row.id, name: row.name, sportId, athletes: [] });
  }

  const first: string[] = [];
  const last: string[] = [];
  const emails: string[] = [];
  const birth: string[] = [];
  const owner = new Map<string, FixtureTeam>();
  for (const team of teams) {
    for (let k = 1; k <= SPORTS[team.sportId].roster; k++) {
      const email = `gen.${team.id}.${k}@gen.local`;
      first.push(random.pick(FIRST_NAMES));
      last.push(random.pick(LAST_NAMES));
      emails.push(email);
      birth.push(`${random.int(1992, 2006)}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`);
      owner.set(email, team);
    }
  }

  const athletes = await pool.query<{ id: number; first_name: string; last_name: string; email: string }>(
    `INSERT INTO athletes (first_name, last_name, birth_date, email)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::text[])
     RETURNING id, first_name, last_name, email`,
    [first, last, birth, emails],
  );

  const memberTeams: number[] = [];
  const memberAthletes: number[] = [];
  const jerseys: number[] = [];
  for (const row of athletes.rows) {
    const team = owner.get(row.email)!;
    team.athletes.push({ id: row.id, name: `${row.first_name} ${row.last_name}` });
    memberTeams.push(team.id);
    memberAthletes.push(row.id);
    jerseys.push(team.athletes.length);
  }
  await pool.query(
    `INSERT INTO team_members (team_id, athlete_id, jersey_number)
     SELECT * FROM unnest($1::int[], $2::int[], $3::int[])`,
    [memberTeams, memberAthletes, jerseys],
  );
  for (const team of teams) team.athletes.sort((a, b) => a.id - b.id);
  return teams;
}

async function createEvents(pool: Pool): Promise<FixtureEvent[]> {
  const events: FixtureEvent[] = [];
  for (const sportId of [FOOTBALL, BASKETBALL]) {
    const names = Array.from({ length: EVENTS_PER_SPORT }, (_, i) => `Ген. ${SPORTS[sportId].name}: ліга ${i + 1}`);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO events (sport_id, venue_id, name, start_date, registration_deadline, max_teams, status)
       SELECT $1, $1, n, current_date - 400, current_date - 410, 32, 'finished' FROM unnest($2::text[]) n
       RETURNING id`,
      [sportId, names],
    );
    for (const row of result.rows) events.push({ id: row.id, sportId });
  }
  return events;
}

export async function createFixture(pool: Pool, matchCount: number): Promise<Fixture> {
  const random = new Random(20261111);
  const teams = await createTeams(pool, random);
  const events = await createEvents(pool);

  const ids = await pool.query<{ id: string }>(
    `SELECT nextval('matches_id_seq') AS id FROM generate_series(1, $1)`, [matchCount]);
  const start = Date.UTC(2025, 0, 1, 12, 0);

  const slots: MatchSlot[] = ids.rows.map((row, i) => {
    const sportId = i % 2 === 0 ? FOOTBALL : BASKETBALL;
    const sportTeams = teams.filter((t) => t.sportId === sportId);
    const [home, away] = random.shuffle(sportTeams).slice(0, 2);
    return {
      matchId: Number(row.id),
      eventId: random.pick(events.filter((e) => e.sportId === sportId)).id,
      sportId,
      playedAt: new Date(start + random.int(0, 364 * 24 * 60) * 60_000),
      home,
      away,
      seed: i + 1,
    };
  });

  for (const part of chunks(slots)) {
    await pool.query(
      `INSERT INTO matches (id, event_id, scheduled_at, status)
       SELECT id, event_id, played_at, 'finished'
       FROM unnest($1::int[], $2::int[], $3::timestamptz[]) AS s(id, event_id, played_at)`,
      [part.map((s) => s.matchId), part.map((s) => s.eventId), part.map((s) => s.playedAt.toISOString())],
    );

    const matchIds: number[] = [];
    const teamIds: number[] = [];
    const isHome: boolean[] = [];
    const scores: number[] = [];
    for (const slot of part) {
      for (const team of generateReport(slot).teams) {
        matchIds.push(slot.matchId);
        teamIds.push(team.teamId);
        isHome.push(team.isHome);
        scores.push(team.score);
      }
    }
    await pool.query(
      `INSERT INTO match_participants (match_id, team_id, is_home, score)
       SELECT * FROM unnest($1::int[], $2::int[], $3::boolean[], $4::int[])`,
      [matchIds, teamIds, isHome, scores],
    );
  }

  return { events, teams, slots };
}
