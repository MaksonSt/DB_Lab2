export interface Team {
  id: number;
  sport_id: number;
  sport_name: string;
  name: string;
  city: string | null;
  coach_name: string | null;
  members_count: number;
  updated_at: Date;
  updated_by: number | null;
  updated_by_name: string | null;
}

export interface Athlete {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: Date;
  age: number;
  email: string | null;
  current_team_id: number | null;
  current_team_name: string | null;
  updated_at: Date;
  updated_by: number | null;
}

export interface RosterEntry {
  membership_id: number;
  team_id: number;
  team_name: string;
  athlete_id: number;
  athlete_name: string;
  jersey_number: number | null;
}

export type TimelineEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'foul'
  | 'timeout'
  | 'buzzer_beater';

export interface ReportTeam {
  teamId: number;
  name: string;
  isHome: boolean;
  score: number;
}

export interface ReportPeriod {
  number: number;
  home: number;
  away: number;
}

export interface TimelineEntry {
  period: number;
  minute: number;
  type: TimelineEventType;
  teamId: number;
  athleteId?: number;
  relatedAthleteId?: number;
  points?: number;
  note?: string;
}

export interface PlayerStatLine {
  athleteId: number;
  name: string;
  teamId: number;
  stats: Record<string, number>;
}

export interface MatchReport {
  matchId: number;
  eventId: number;
  sportId: number;
  sport: string;
  playedAt: Date;
  attendance: number;
  teams: ReportTeam[];
  periods: ReportPeriod[];
  timeline: TimelineEntry[];
  playerStats: PlayerStatLine[];
}

export interface PlayerTotal {
  athleteId: number;
  name: string;
  total: number;
  matches: number;
}

export interface StatAverage {
  statCode: string;
  avg: number;
  matches: number;
}

export interface EventCardCount {
  eventId: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchReportStore {
  insert(report: MatchReport): Promise<void>;
  insertMany(reports: MatchReport[]): Promise<void>;
  getByMatchId(matchId: number): Promise<MatchReport | null>;
  findMatchesWith(eventId: number, type: TimelineEventType): Promise<number[]>;
  topPlayers(eventId: number, statCode: string, limit: number): Promise<PlayerTotal[]>;
  athleteAverages(athleteId: number): Promise<StatAverage[]>;
  cardsPerEvent(): Promise<EventCardCount[]>;
  addEvent(matchId: number, entry: TimelineEntry, statCode: string | null): Promise<void>;
  setAttendance(matchId: number, attendance: number): Promise<void>;
  deleteByMatchIds(matchIds: number[]): Promise<void>;
}
