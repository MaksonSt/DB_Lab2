CREATE FUNCTION fn_current_user_id()
RETURNS INT
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::INT;
$$;

CREATE FUNCTION fn_athlete_age(p_birth_date DATE)
RETURNS INT
LANGUAGE sql STABLE
AS $$
    SELECT date_part('year', age(current_date, p_birth_date))::INT;
$$;

CREATE FUNCTION fn_event_free_slots(p_event_id INT)
RETURNS INT
LANGUAGE sql STABLE
AS $$
    SELECT e.max_teams - (SELECT count(*) FROM event_registrations r WHERE r.event_id = e.id)::INT
    FROM events e
    WHERE e.id = p_event_id;
$$;
