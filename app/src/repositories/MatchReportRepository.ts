import { BaseRepository } from './BaseRepository.js';
import type {
  EventCardCount,
  MatchReport,
  MatchReportStore,
  PlayerTotal,
  StatAverage,
  TimelineEntry,
  TimelineEventType,
} from '../models.js';

interface ReportRow {
  match_id: number;
  report: Omit<MatchReport, 'playedAt'> & { playedAt: string };
}

interface TopPlayerRow {
  athlete_id: number;
  athlete_name: string;
  total: number;
  matches: number;
}

interface AverageRow {
  stat_code: string;
  avg_value: number;
  matches: number;
}

interface CardRow {
  event_id: number;
  yellow_cards: number;
  red_cards: number;
}

export class MatchReportRepository extends BaseRepository implements MatchReportStore {
  insert(report: MatchReport): Promise<void> {
    return this.insertMany([report]);
  }

  async insertMany(reports: MatchReport[]): Promise<void> {
    await this.callProcedure('sp_match_reports_import', [JSON.stringify(reports)]);
  }

  async getByMatchId(matchId: number): Promise<MatchReport | null> {
    const rows = await this.fromView<ReportRow>('v_match_reports', 'match_id', matchId);
    if (!rows[0]) return null;
    const { report } = rows[0];
    return { ...report, playedAt: new Date(report.playedAt) };
  }

  async findMatchesWith(eventId: number, type: TimelineEventType): Promise<number[]> {
    const rows = await this.fromFunction<{ match_id: number }>('fn_event_matches_with', [eventId, type]);
    return rows.map((r) => r.match_id);
  }

  async topPlayers(eventId: number, statCode: string, limit: number): Promise<PlayerTotal[]> {
    const rows = await this.fromFunction<TopPlayerRow>('fn_event_top_players', [eventId, statCode, limit]);
    return rows.map((r) => ({ athleteId: r.athlete_id, name: r.athlete_name, total: r.total, matches: r.matches }));
  }

  async athleteAverages(athleteId: number): Promise<StatAverage[]> {
    const rows = await this.fromFunction<AverageRow>('fn_athlete_stat_averages', [athleteId]);
    return rows.map((r) => ({ statCode: r.stat_code, avg: r.avg_value, matches: r.matches }));
  }

  async cardsPerEvent(): Promise<EventCardCount[]> {
    const rows = await this.fromView<CardRow>('v_event_card_counts');
    return rows
      .map((r) => ({ eventId: r.event_id, yellowCards: r.yellow_cards, redCards: r.red_cards }))
      .sort((a, b) => a.eventId - b.eventId);
  }

  async addEvent(matchId: number, entry: TimelineEntry, statCode: string | null): Promise<void> {
    await this.callProcedure('sp_match_report_add_event', [matchId, JSON.stringify(entry), statCode, 1]);
  }

  async setAttendance(matchId: number, attendance: number): Promise<void> {
    await this.callProcedure('sp_match_report_set_attendance', [matchId, attendance]);
  }

  async deleteByMatchIds(matchIds: number[]): Promise<void> {
    await this.callProcedure('sp_match_reports_delete', [matchIds]);
  }
}
