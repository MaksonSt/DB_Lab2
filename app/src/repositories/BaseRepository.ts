import type { PoolClient } from 'pg';

type SqlValue = string | number | null;

export abstract class BaseRepository {
  constructor(protected readonly client: PoolClient) {}

  protected async callProcedure(name: string, args: SqlValue[], returnsId = false): Promise<number> {
    const params = args.map((_, i) => `$${i + 1}`);
    if (returnsId) params.push('NULL');

    const result = await this.client.query(`CALL ${name}(${params.join(', ')})`, args);
    return returnsId ? result.rows[0].p_id : 0;
  }

  protected async fromView<T>(view: string, column?: string, value?: SqlValue): Promise<T[]> {
    const sql = column ? `SELECT * FROM ${view} WHERE ${column} = $1` : `SELECT * FROM ${view}`;
    const result = await this.client.query(sql, column ? [value] : []);
    return result.rows as T[];
  }
}
