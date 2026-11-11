import type { MatchReport, PlayerStatLine, ReportPeriod, TimelineEntry, TimelineEventType } from '../models.js';
import { BASKETBALL, SPORTS, type FixtureAthlete, type FixtureTeam, type MatchSlot } from './fixture.js';
import { Random } from './random.js';

interface Side {
  team: FixtureTeam;
  isHome: boolean;
  players: FixtureAthlete[];
  stats: Map<number, Record<string, number>>;
}

interface EntryInput {
  period: number;
  minute: number;
  type: TimelineEventType;
  teamId: number;
  athleteId?: number;
  relatedAthleteId?: number;
  points?: number;
  note?: string;
}

function entry(input: EntryInput): TimelineEntry {
  const result: TimelineEntry = { period: input.period, minute: input.minute, type: input.type, teamId: input.teamId };
  if (input.athleteId !== undefined) result.athleteId = input.athleteId;
  if (input.relatedAthleteId !== undefined) result.relatedAthleteId = input.relatedAthleteId;
  if (input.points !== undefined) result.points = input.points;
  if (input.note !== undefined) result.note = input.note;
  return result;
}

function footballGoals(random: Random): number {
  return random.pick([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5]);
}

function football(random: Random, sides: Side[], timeline: TimelineEntry[]): ReportPeriod[] {
  const periods: ReportPeriod[] = [{ number: 1, home: 0, away: 0 }, { number: 2, home: 0, away: 0 }];

  for (const side of sides) {
    const lineup = random.shuffle(side.team.athletes).slice(0, 14);
    const starters = lineup.slice(0, 11);
    const subs = lineup.slice(11);
    side.players = lineup;

    for (const [i, player] of lineup.entries()) {
      side.stats.set(player.id, {
        minutes: i < 11 ? 90 : 0, goals: 0, assists: 0, shots: 0,
        passes: 0, fouls: 0, saves: i === 0 ? random.int(0, 7) : 0,
      });
    }

    const outfield = random.shuffle(starters.slice(1));
    for (const [i, sub] of subs.entries()) {
      const minute = random.int(46, 85);
      const out = outfield[i];
      side.stats.get(out.id)!.minutes = minute;
      side.stats.get(sub.id)!.minutes = 90 - minute;
      timeline.push(entry({ period: 2, minute, type: 'substitution', teamId: side.team.id, athleteId: sub.id, relatedAthleteId: out.id }));
    }

    const scorers = [...starters.slice(1), ...subs];
    const goals = footballGoals(random);
    for (let g = 0; g < goals; g++) {
      const minute = random.int(1, 90);
      const period = minute <= 45 ? 1 : 2;
      const scorer = random.pick(scorers);
      const assist = random.chance(0.7) ? random.pick(scorers.filter((p) => p.id !== scorer.id)) : undefined;
      side.stats.get(scorer.id)!.goals++;
      if (assist) side.stats.get(assist.id)!.assists++;
      periods[period - 1][side.isHome ? 'home' : 'away']++;
      timeline.push(entry({
        period, minute, type: 'goal', teamId: side.team.id, athleteId: scorer.id,
        relatedAthleteId: assist?.id, note: random.pick(['open_play', 'header', 'penalty', 'free_kick']),
      }));
    }

    const cards = random.int(0, 4);
    for (let c = 0; c < cards; c++) {
      const minute = random.int(1, 90);
      const player = random.pick(starters);
      side.stats.get(player.id)!.fouls++;
      timeline.push(entry({ period: minute <= 45 ? 1 : 2, minute, type: 'yellow_card', teamId: side.team.id, athleteId: player.id }));
    }
    if (random.chance(0.12)) {
      const minute = random.int(20, 90);
      const player = random.pick(starters);
      side.stats.get(player.id)!.fouls++;
      timeline.push(entry({ period: minute <= 45 ? 1 : 2, minute, type: 'red_card', teamId: side.team.id, athleteId: player.id }));
    }

    for (const player of lineup) {
      const stats = side.stats.get(player.id)!;
      stats.shots = stats.goals + random.int(0, 4);
      stats.passes = Math.round((stats.minutes / 90) * random.int(10, 70));
      stats.fouls += random.int(0, 2);
    }
  }
  return periods;
}

function splitPoints(random: Random, total: number, count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => (i < 5 ? 1.5 : 0.6) * (0.3 + random.next()));
  const sum = weights.reduce((a, b) => a + b, 0);
  const points = weights.map((w) => Math.floor((w / sum) * total));
  let rest = total - points.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % count, rest--) points[i]++;
  return points;
}

function basketball(random: Random, sides: Side[], timeline: TimelineEntry[]): ReportPeriod[] {
  const periods: ReportPeriod[] = [1, 2, 3, 4].map((number) => ({ number, home: 0, away: 0 }));
  const quarterOf = (minute: number) => Math.min(4, Math.ceil(minute / 12));

  for (const side of sides) {
    const lineup = random.shuffle(side.team.athletes).slice(0, 10);
    side.players = lineup;
    let total = 0;
    for (const period of periods) {
      const score = random.int(14, 32);
      period[side.isHome ? 'home' : 'away'] = score;
      total += score;
    }

    const points = splitPoints(random, total, lineup.length);
    for (const [i, player] of lineup.entries()) {
      const fouls = random.int(0, 5);
      side.stats.set(player.id, {
        minutes: i < 5 ? random.int(24, 38) : random.int(6, 22),
        points: points[i],
        rebounds: random.int(0, 12),
        assists: random.int(0, 9),
        steals: random.int(0, 3),
        blocks: random.int(0, 3),
        fouls,
        threes: Math.min(Math.floor(points[i] / 3), random.int(0, 4)),
      });
      for (let f = 0; f < fouls; f++) {
        const minute = random.int(1, 48);
        timeline.push(entry({
          period: quarterOf(minute), minute, type: 'foul', teamId: side.team.id, athleteId: player.id,
          note: random.pick(['personal', 'shooting', 'offensive']),
        }));
      }
    }

    const timeouts = random.int(2, 4);
    for (let t = 0; t < timeouts; t++) {
      const minute = random.int(1, 48);
      timeline.push(entry({ period: quarterOf(minute), minute, type: 'timeout', teamId: side.team.id }));
    }

    if (random.chance(0.3)) {
      const period = random.int(1, 4);
      const shooter = random.pick(lineup.slice(0, 5));
      timeline.push(entry({
        period, minute: period * 12, type: 'buzzer_beater', teamId: side.team.id,
        athleteId: shooter.id, points: random.pick([2, 3]),
      }));
    }
  }
  return periods;
}

export function generateReport(slot: MatchSlot): MatchReport {
  const random = new Random(slot.seed * 7919 + 13);
  const sides: Side[] = [
    { team: slot.home, isHome: true, players: [], stats: new Map() },
    { team: slot.away, isHome: false, players: [], stats: new Map() },
  ];
  const timeline: TimelineEntry[] = [];
  const periods = slot.sportId === BASKETBALL
    ? basketball(random, sides, timeline)
    : football(random, sides, timeline);

  timeline.sort((a, b) => a.minute - b.minute);

  const playerStats: PlayerStatLine[] = sides
    .flatMap((side) => side.players.map((p) => ({
      athleteId: p.id, name: p.name, teamId: side.team.id, stats: side.stats.get(p.id)!,
    })))
    .sort((a, b) => a.athleteId - b.athleteId);

  const score = (home: boolean) => periods.reduce((sum, p) => sum + (home ? p.home : p.away), 0);

  return {
    matchId: slot.matchId,
    eventId: slot.eventId,
    sportId: slot.sportId,
    sport: SPORTS[slot.sportId].name,
    playedAt: slot.playedAt,
    attendance: random.int(800, 42000),
    teams: sides.map((s) => ({ teamId: s.team.id, name: s.team.name, isHome: s.isHome, score: score(s.isHome) })),
    periods,
    timeline,
    playerStats,
  };
}
