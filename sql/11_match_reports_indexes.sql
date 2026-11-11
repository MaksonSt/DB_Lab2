CREATE UNIQUE INDEX ux_match_reports_match_id ON match_reports (match_id);

CREATE INDEX ix_matches_event_id ON matches (event_id);

CREATE INDEX ix_player_match_stats_athlete_id ON player_match_stats (athlete_id);

CREATE INDEX ix_match_report_events_type ON match_report_events (event_type);
