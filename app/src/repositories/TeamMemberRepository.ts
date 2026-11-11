import { BaseRepository } from './BaseRepository.js';
import type { RosterEntry } from '../models.js';

export class TeamMemberRepository extends BaseRepository {
  getRoster(teamId: number): Promise<RosterEntry[]> {
    return this.fromView<RosterEntry>('v_team_roster', 'team_id', teamId);
  }

  add(teamId: number, athleteId: number, jerseyNumber: number | null): Promise<number> {
    return this.callProcedure('sp_team_member_add', [teamId, athleteId, jerseyNumber], true);
  }
}
