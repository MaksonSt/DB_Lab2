CREATE PROCEDURE sp_match_reports_import(p_reports JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
    WITH src AS (
        SELECT x AS doc, (x->>'matchId')::INT AS match_id, (x->>'sportId')::INT AS sport_id
        FROM jsonb_array_elements(p_reports) x
    ),
    ins AS (
        INSERT INTO match_reports (match_id, attendance)
        SELECT match_id, (doc->>'attendance')::INT FROM src
        RETURNING id, match_id
    ),
    per AS (
        INSERT INTO match_report_periods (report_id, period_no, home_score, away_score)
        SELECT ins.id, (p->>'number')::SMALLINT, (p->>'home')::INT, (p->>'away')::INT
        FROM src
        JOIN ins ON ins.match_id = src.match_id
        CROSS JOIN jsonb_array_elements(src.doc->'periods') p
    ),
    evs AS (
        INSERT INTO match_report_events (report_id, seq, period_no, minute, event_type, team_id,
                                         athlete_id, related_athlete_id, points, note)
        SELECT ins.id, t.ord, (t.e->>'period')::SMALLINT, (t.e->>'minute')::SMALLINT, t.e->>'type',
               (t.e->>'teamId')::INT, (t.e->>'athleteId')::INT, (t.e->>'relatedAthleteId')::INT,
               (t.e->>'points')::SMALLINT, t.e->>'note'
        FROM src
        JOIN ins ON ins.match_id = src.match_id
        CROSS JOIN jsonb_array_elements(src.doc->'timeline') WITH ORDINALITY t(e, ord)
    )
    INSERT INTO player_match_stats (report_id, athlete_id, stat_id, team_id, value)
    SELECT ins.id, (ps->>'athleteId')::INT, d.id, (ps->>'teamId')::INT, st.value::INT
    FROM src
    JOIN ins ON ins.match_id = src.match_id
    CROSS JOIN jsonb_array_elements(src.doc->'playerStats') ps
    CROSS JOIN jsonb_each_text(ps->'stats') st
    LEFT JOIN stat_definitions d ON d.sport_id = src.sport_id AND d.code = st.key;
END;
$$;

CREATE PROCEDURE sp_match_report_add_event(p_match_id INT, p_event JSONB, p_stat_code VARCHAR, p_delta INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_report_id INT;
    v_sport_id  INT;
BEGIN
    SELECT r.id, e.sport_id INTO v_report_id, v_sport_id
    FROM match_reports r
    JOIN matches m ON m.id = r.match_id
    JOIN events e  ON e.id = m.event_id
    WHERE r.match_id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Протокол матчу id=% не знайдено', p_match_id;
    END IF;

    INSERT INTO match_report_events (report_id, seq, period_no, minute, event_type, team_id,
                                     athlete_id, related_athlete_id, points, note)
    SELECT v_report_id,
           coalesce((SELECT max(seq) FROM match_report_events WHERE report_id = v_report_id), 0) + 1,
           (p_event->>'period')::SMALLINT, (p_event->>'minute')::SMALLINT, p_event->>'type',
           (p_event->>'teamId')::INT, (p_event->>'athleteId')::INT, (p_event->>'relatedAthleteId')::INT,
           (p_event->>'points')::SMALLINT, p_event->>'note';

    IF p_stat_code IS NOT NULL THEN
        INSERT INTO player_match_stats (report_id, athlete_id, stat_id, team_id, value)
        SELECT v_report_id, (p_event->>'athleteId')::INT, d.id, (p_event->>'teamId')::INT, p_delta
        FROM stat_definitions d
        WHERE d.sport_id = v_sport_id AND d.code = p_stat_code
        ON CONFLICT (report_id, athlete_id, stat_id)
        DO UPDATE SET value = player_match_stats.value + EXCLUDED.value;
    END IF;
END;
$$;

CREATE PROCEDURE sp_match_report_set_attendance(p_match_id INT, p_attendance INT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE match_reports SET attendance = p_attendance WHERE match_id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Протокол матчу id=% не знайдено', p_match_id;
    END IF;
END;
$$;

CREATE PROCEDURE sp_match_reports_delete(p_match_ids INT[])
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM match_reports WHERE match_id = ANY (p_match_ids);
END;
$$;
