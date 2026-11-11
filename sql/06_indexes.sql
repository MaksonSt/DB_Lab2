CREATE INDEX ix_teams_sport_id ON teams (sport_id);

CREATE UNIQUE INDEX ux_teams_sport_name_active
    ON teams (sport_id, name) WHERE NOT is_deleted;

CREATE INDEX hash_athletes_email ON athletes USING hash (email);
