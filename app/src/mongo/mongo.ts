import { MongoClient, type Collection } from 'mongodb';
import type { MatchReport } from '../models.js';

export const mongoClient = new MongoClient(
  process.env.MONGO_URL ?? 'mongodb://lab:lab@localhost:37017/?authSource=admin',
  { writeConcern: { w: 1, journal: true } },
);

export function matchReports(): Collection<MatchReport> {
  return mongoClient.db('sports_events').collection<MatchReport>('match_reports');
}

export async function ensureIndexes(collection: Collection<MatchReport>): Promise<void> {
  await collection.createIndexes([
    { key: { matchId: 1 }, name: 'ux_match_id', unique: true },
    { key: { eventId: 1 }, name: 'ix_event_id' },
    { key: { 'playerStats.athleteId': 1 }, name: 'ix_player_stats_athlete_id' },
    { key: { 'timeline.type': 1 }, name: 'ix_timeline_type' },
  ]);
}
