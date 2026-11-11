import { BaseRepository } from './BaseRepository.js';
import type { Athlete } from '../models.js';

export class AthleteRepository extends BaseRepository {
  async getById(id: number): Promise<Athlete | null> {
    const rows = await this.fromView<Athlete>('v_athletes', 'id', id);
    return rows[0] ?? null;
  }

  create(firstName: string, lastName: string, birthDate: string, email: string | null): Promise<number> {
    return this.callProcedure('sp_athlete_create', [firstName, lastName, birthDate, email], true);
  }

  async delete(id: number): Promise<void> {
    await this.callProcedure('sp_athlete_delete', [id]);
  }
}
