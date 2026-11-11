import type { Collection } from 'mongodb';
import type {
  EventCardCount,
  MatchReport,
  MatchReportStore,
  PlayerTotal,
  StatAverage,
  TimelineEntry,
  TimelineEventType,
} from '../models.js';

export class MongoMatchReportRepository implements MatchReportStore {
  constructor(private readonly collection: Collection<MatchReport>) {}

  async insert(report: MatchReport): Promise<void> {
    await this.collection.insertOne({ ...report });
  }

  async insertMany(reports: MatchReport[]): Promise<void> {
    await this.collection.insertMany(reports.map((r) => ({ ...r })), { ordered: true });
  }

  getByMatchId(matchId: number): Promise<MatchReport | null> {
    return this.collection.findOne({ matchId }, { projection: { _id: 0 } });
  }

  async findMatchesWith(eventId: number, type: TimelineEventType): Promise<number[]> {
    const docs = await this.collection
      .find({ eventId, 'timeline.type': type }, { projection: { _id: 0, matchId: 1 } })
      .sort({ matchId: 1 })
      .toArray();
    return docs.map((d) => d.matchId);
  }

  topPlayers(eventId: number, statCode: string, limit: number): Promise<PlayerTotal[]> {
    return this.collection
      .aggregate<PlayerTotal>([
        { $match: { eventId } },
        { $unwind: '$playerStats' },
        { $match: { [`playerStats.stats.${statCode}`]: { $exists: true } } },
        {
          $group: {
            _id: '$playerStats.athleteId',
            name: { $first: '$playerStats.name' },
            total: { $sum: `$playerStats.stats.${statCode}` },
            matches: { $sum: 1 },
          },
        },
        { $sort: { total: -1, _id: 1 } },
        { $limit: limit },
        { $project: { _id: 0, athleteId: '$_id', name: 1, total: 1, matches: 1 } },
      ])
      .toArray();
  }

  athleteAverages(athleteId: number): Promise<StatAverage[]> {
    return this.collection
      .aggregate<StatAverage>([
        { $match: { 'playerStats.athleteId': athleteId } },
        { $unwind: '$playerStats' },
        { $match: { 'playerStats.athleteId': athleteId } },
        { $project: { stat: { $objectToArray: '$playerStats.stats' } } },
        { $unwind: '$stat' },
        { $group: { _id: '$stat.k', avg: { $avg: '$stat.v' }, matches: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, statCode: '$_id', avg: { $round: ['$avg', 2] }, matches: 1 } },
      ])
      .toArray();
  }

  cardsPerEvent(): Promise<EventCardCount[]> {
    const cards = ['yellow_card', 'red_card'];
    return this.collection
      .aggregate<EventCardCount>([
        { $match: { 'timeline.type': { $in: cards } } },
        { $unwind: '$timeline' },
        { $match: { 'timeline.type': { $in: cards } } },
        {
          $group: {
            _id: '$eventId',
            yellowCards: { $sum: { $cond: [{ $eq: ['$timeline.type', 'yellow_card'] }, 1, 0] } },
            redCards: { $sum: { $cond: [{ $eq: ['$timeline.type', 'red_card'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, eventId: '$_id', yellowCards: 1, redCards: 1 } },
      ])
      .toArray();
  }

  async addEvent(matchId: number, entry: TimelineEntry, statCode: string | null): Promise<void> {
    const update = statCode
      ? { $push: { timeline: entry }, $inc: { [`playerStats.$[p].stats.${statCode}`]: 1 } }
      : { $push: { timeline: entry } };
    const options = statCode ? { arrayFilters: [{ 'p.athleteId': entry.athleteId }] } : {};
    const result = await this.collection.updateOne({ matchId }, update, options);
    if (result.matchedCount === 0) throw new Error(`Протокол матчу id=${matchId} не знайдено`);
  }

  async setAttendance(matchId: number, attendance: number): Promise<void> {
    const result = await this.collection.updateOne({ matchId }, { $set: { attendance } });
    if (result.matchedCount === 0) throw new Error(`Протокол матчу id=${matchId} не знайдено`);
  }

  async deleteByMatchIds(matchIds: number[]): Promise<void> {
    await this.collection.deleteMany({ matchId: { $in: matchIds } });
  }
}
