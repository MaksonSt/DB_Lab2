CREATE VIEW v_match_reports AS
SELECT r.match_id,
       jsonb_build_object(
           'matchId',    r.match_id,
           'eventId',    m.event_id,
           'sportId',    e.sport_id,
           'sport',      s.name,
           'playedAt',   m.scheduled_at,
           'attendance', r.attendance,
           'teams', (
               SELECT jsonb_agg(jsonb_build_object(
                          'teamId', p.team_id, 'name', t.name, 'isHome', p.is_home, 'score', p.score)
                      ORDER BY p.is_home DESC)
               FROM match_participants p
               JOIN teams t ON t.id = p.team_id
               WHERE p.match_id = r.match_id),
           'periods', (
               SELECT jsonb_agg(jsonb_build_object(
                          'number', pr.period_no, 'home', pr.home_score, 'away', pr.away_score)
                      ORDER BY pr.period_no)
               FROM match_report_periods pr
               WHERE pr.report_id = r.id),
           'timeline', (
               SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                          'period', ev.period_no, 'minute', ev.minute, 'type', ev.event_type,
                          'teamId', ev.team_id, 'athleteId', ev.athlete_id,
                          'relatedAthleteId', ev.related_athlete_id,
                          'points', ev.points, 'note', ev.note))
                      ORDER BY ev.seq), '[]'::jsonb)
               FROM match_report_events ev
               WHERE ev.report_id = r.id),
           'playerStats', (
               SELECT jsonb_agg(jsonb_build_object(
                          'athleteId', g.athlete_id,
                          'name', a.first_name || ' ' || a.last_name,
                          'teamId', g.team_id,
                          'stats', g.stats)
                      ORDER BY g.athlete_id)
               FROM (SELECT ps.athlete_id, ps.team_id, jsonb_object_agg(d.code, ps.value) AS stats
                     FROM player_match_stats ps
                     JOIN stat_definitions d ON d.id = ps.stat_id
                     WHERE ps.report_id = r.id
                     GROUP BY ps.athlete_id, ps.team_id) g
               JOIN athletes a ON a.id = g.athlete_id)
       ) AS report
FROM match_reports r
JOIN matches m ON m.id = r.match_id
JOIN events e  ON e.id = m.event_id
JOIN sports s  ON s.id = e.sport_id;

CREATE VIEW v_event_card_counts AS
SELECT m.event_id,
       count(*) FILTER (WHERE ev.event_type = 'yellow_card')::INT AS yellow_cards,
       count(*) FILTER (WHERE ev.event_type = 'red_card')::INT    AS red_cards
FROM match_report_events ev
JOIN match_reports r ON r.id = ev.report_id
JOIN matches m       ON m.id = r.match_id
WHERE ev.event_type IN ('yellow_card', 'red_card')
GROUP BY m.event_id;

CREATE FUNCTION fn_event_top_players(p_event_id INT, p_stat_code VARCHAR, p_limit INT)
RETURNS TABLE (athlete_id INT, athlete_name TEXT, total INT, matches INT)
LANGUAGE sql STABLE
AS $$
    SELECT ps.athlete_id, a.first_name || ' ' || a.last_name, sum(ps.value)::INT, count(*)::INT
    FROM player_match_stats ps
    JOIN match_reports r    ON r.id = ps.report_id
    JOIN matches m          ON m.id = r.match_id
    JOIN stat_definitions d ON d.id = ps.stat_id
    JOIN athletes a         ON a.id = ps.athlete_id
    WHERE m.event_id = p_event_id AND d.code = p_stat_code
    GROUP BY ps.athlete_id, a.first_name, a.last_name
    ORDER BY 3 DESC, 1
    LIMIT p_limit;
$$;

CREATE FUNCTION fn_athlete_stat_averages(p_athlete_id INT)
RETURNS TABLE (stat_code VARCHAR, avg_value FLOAT8, matches INT)
LANGUAGE sql STABLE
AS $$
    SELECT d.code, round(avg(ps.value), 2)::FLOAT8, count(*)::INT
    FROM player_match_stats ps
    JOIN stat_definitions d ON d.id = ps.stat_id
    WHERE ps.athlete_id = p_athlete_id
    GROUP BY d.code
    ORDER BY d.code;
$$;

CREATE FUNCTION fn_event_matches_with(p_event_id INT, p_event_type VARCHAR)
RETURNS TABLE (match_id INT)
LANGUAGE sql STABLE
AS $$
    SELECT r.match_id
    FROM match_reports r
    JOIN matches m ON m.id = r.match_id
    WHERE m.event_id = p_event_id
      AND EXISTS (SELECT 1 FROM match_report_events ev
                  WHERE ev.report_id = r.id AND ev.event_type = p_event_type)
    ORDER BY r.match_id;
$$;
