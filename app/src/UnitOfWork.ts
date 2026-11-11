import type { Pool, PoolClient } from 'pg';
import { AthleteRepository } from './repositories/AthleteRepository.js';
import { TeamMemberRepository } from './repositories/TeamMemberRepository.js';
import { TeamRepository } from './repositories/TeamRepository.js';

export class UnitOfWork {
  readonly teams: TeamRepository;
  readonly athletes: AthleteRepository;
  readonly teamMembers: TeamMemberRepository;

  private constructor(private readonly client: PoolClient) {
    this.teams = new TeamRepository(client);
    this.athletes = new AthleteRepository(client);
    this.teamMembers = new TeamMemberRepository(client);
  }

  static async begin(pool: Pool, userId: number): Promise<UnitOfWork> {
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    return new UnitOfWork(client);
  }

  async commit(): Promise<void> {
    try {
      await this.client.query('COMMIT');
    } finally {
      this.client.release();
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.client.query('ROLLBACK');
    } finally {
      this.client.release();
    }
  }

  static async run<T>(pool: Pool, userId: number, work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    const uow = await UnitOfWork.begin(pool, userId);
    try {
      const result = await work(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }
}
