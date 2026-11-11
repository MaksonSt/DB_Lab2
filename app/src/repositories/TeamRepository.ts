import { BaseRepository } from './BaseRepository.js';
import type { Team } from '../models.js';

export class TeamRepository extends BaseRepository {
  async getById(id: number): Promise<Team | null> {
    const rows = await this.fromView<Team>('v_teams', 'id', id);
    return rows[0] ?? null;
  }

  getAll(): Promise<Team[]> {
    return this.fromView<Team>('v_teams');
  }

  create(sportId: number, name: string, city: string | null, coachName: string | null): Promise<number> {
    return this.callProcedure('sp_team_create', [sportId, name, city, coachName], true);
  }

  async update(id: number, name: string, city: string | null, coachName: string | null): Promise<void> {
    await this.callProcedure('sp_team_update', [id, name, city, coachName]);
  }

  async delete(id: number): Promise<void> {
    await this.callProcedure('sp_team_delete', [id]);
  }
}
