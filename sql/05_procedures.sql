CREATE PROCEDURE sp_team_create(
    p_sport_id   INT,
    p_name       VARCHAR,
    p_city       VARCHAR,
    p_coach_name VARCHAR,
    INOUT p_id   INT DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO teams (sport_id, name, city, coach_name)
    VALUES (p_sport_id, p_name, p_city, p_coach_name)
    RETURNING id INTO p_id;
END;
$$;

CREATE PROCEDURE sp_team_update(
    p_id         INT,
    p_name       VARCHAR,
    p_city       VARCHAR,
    p_coach_name VARCHAR)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE teams
       SET name = p_name, city = p_city, coach_name = p_coach_name
     WHERE id = p_id AND NOT is_deleted;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Команду id=% не знайдено', p_id;
    END IF;
END;
$$;

CREATE PROCEDURE sp_team_delete(p_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM team_members WHERE team_id = p_id;
    UPDATE teams
       SET is_deleted = TRUE, deleted_at = now(), deleted_by = fn_current_user_id()
     WHERE id = p_id;
END;
$$;

CREATE PROCEDURE sp_athlete_create(
    p_first_name VARCHAR,
    p_last_name  VARCHAR,
    p_birth_date DATE,
    p_email      VARCHAR,
    INOUT p_id   INT DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO athletes (first_name, last_name, birth_date, email)
    VALUES (p_first_name, p_last_name, p_birth_date, p_email)
    RETURNING id INTO p_id;
END;
$$;

CREATE PROCEDURE sp_athlete_delete(p_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM team_members WHERE athlete_id = p_id;
    UPDATE athletes
       SET is_deleted = TRUE, deleted_at = now(), deleted_by = fn_current_user_id()
     WHERE id = p_id;
END;
$$;

CREATE PROCEDURE sp_team_member_add(
    p_team_id       INT,
    p_athlete_id    INT,
    p_jersey_number INT,
    INOUT p_id      INT DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM team_members WHERE athlete_id = p_athlete_id;

    INSERT INTO team_members (team_id, athlete_id, jersey_number)
    VALUES (p_team_id, p_athlete_id, p_jersey_number)
    RETURNING id INTO p_id;
END;
$$;

CREATE PROCEDURE sp_event_register_team(
    p_event_id INT,
    p_team_id  INT,
    INOUT p_id INT DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO event_registrations (event_id, team_id)
    VALUES (p_event_id, p_team_id)
    RETURNING id INTO p_id;
END;
$$;
