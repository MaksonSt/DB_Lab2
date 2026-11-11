CREATE VIEW v_teams AS
SELECT t.id, t.sport_id, s.name AS sport_name,
       t.name, t.city, t.coach_name,
       (SELECT count(*)::INT FROM team_members tm WHERE tm.team_id = t.id) AS members_count,
       t.updated_at, t.updated_by, u.full_name AS updated_by_name
FROM teams t
JOIN sports s     ON s.id = t.sport_id
LEFT JOIN users u ON u.id = t.updated_by
WHERE NOT t.is_deleted;

CREATE VIEW v_athletes AS
SELECT a.id, a.first_name, a.last_name, a.birth_date,
       fn_athlete_age(a.birth_date) AS age,
       a.email,
       tm.team_id AS current_team_id,
       t.name     AS current_team_name,
       a.updated_at, a.updated_by
FROM athletes a
LEFT JOIN team_members tm ON tm.athlete_id = a.id
LEFT JOIN teams t         ON t.id = tm.team_id
WHERE NOT a.is_deleted;

CREATE VIEW v_team_roster AS
SELECT tm.id AS membership_id,
       tm.team_id, t.name AS team_name,
       tm.athlete_id, a.first_name || ' ' || a.last_name AS athlete_name,
       tm.jersey_number
FROM team_members tm
JOIN teams t    ON t.id = tm.team_id
JOIN athletes a ON a.id = tm.athlete_id;

CREATE VIEW v_event_registrations AS
SELECT r.id, r.event_id, e.name AS event_name,
       r.team_id, t.name AS team_name,
       r.registered_at,
       fn_event_free_slots(e.id) AS free_slots
FROM event_registrations r
JOIN events e ON e.id = r.event_id
JOIN teams t  ON t.id = r.team_id;
