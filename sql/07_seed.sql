SELECT set_config('app.current_user_id', '1', false);

INSERT INTO roles (name) VALUES ('admin'), ('organizer'), ('team_manager');

INSERT INTO users (role_id, email, full_name) VALUES
    (1, 'admin@sport.local',   'Адміністратор'),
    (2, 'olena@sport.local',   'Олена Коваль'),
    (3, 'ivan@sport.local',    'Іван Петренко');

INSERT INTO sports (name) VALUES ('Футбол'), ('Баскетбол');

INSERT INTO venues (name, city, capacity) VALUES
    ('Центральний стадіон', 'Київ',  45000),
    ('Палац спорту',        'Львів',  7000);

INSERT INTO teams (sport_id, name, city, coach_name) VALUES
    (1, 'ФК Дніпрові Вовки', 'Київ',   'Сергій Ткаченко'),
    (1, 'ФК Степові Орли',   'Харків', 'Андрій Мельник'),
    (2, 'БК Блискавки',      'Київ',   'Дмитро Савченко'),
    (2, 'БК Хвилі',          'Одеса',  'Роман Литвин');

INSERT INTO athletes (first_name, last_name, birth_date, email) VALUES
    ('Олександр', 'Бойко',     '1998-03-14', 'boiko@mail.local'),
    ('Микола',    'Кравченко', '2000-07-02', 'kravchenko@mail.local'),
    ('Артем',     'Шевченко',  '1999-05-30', 'shevchenko@mail.local'),
    ('Богдан',    'Поліщук',   '2001-09-17', NULL),
    ('Анна',      'Мельничук', '2000-04-04', NULL),
    ('Софія',     'Кузьменко', '2001-08-22', NULL);

INSERT INTO team_members (team_id, athlete_id, jersey_number) VALUES
    (1, 1, 1), (1, 2, 7),
    (2, 3, 1), (2, 4, 9),
    (3, 5, 5), (4, 6, 7);

INSERT INTO referees (sport_id, full_name) VALUES
    (1, 'Анатолій Сахно'), (2, 'Григорій Бабенко');

INSERT INTO events (sport_id, venue_id, name, start_date, registration_deadline, max_teams)
VALUES (1, 1, 'Кубок Столиці', current_date + 30, current_date + 20, 16);

INSERT INTO events (sport_id, venue_id, name, start_date, registration_deadline, max_teams, status)
VALUES (2, 2, 'Баскетбольна ліга', current_date - 30, current_date - 40, 2, 'finished');

INSERT INTO event_registrations (event_id, team_id) VALUES (1, 1), (1, 2);

INSERT INTO matches (event_id, scheduled_at, status) VALUES (2, now() - interval '30 days', 'finished');
INSERT INTO match_participants (match_id, team_id, is_home, score) VALUES (1, 3, TRUE, 80), (1, 4, FALSE, 75);
INSERT INTO match_referees (match_id, referee_id) VALUES (1, 2);

INSERT INTO ticket_types (event_id, name, price) VALUES (1, 'Стандарт', 250), (1, 'VIP', 1200);
INSERT INTO tickets (ticket_type_id, buyer_email) VALUES (1, 'petro@mail.local'), (2, 'oleg@mail.local');

INSERT INTO sponsors (name) VALUES ('СпортМаркет'), ('Банк «Надійний»');
INSERT INTO event_sponsors (event_id, sponsor_id, amount) VALUES (1, 1, 100000), (1, 2, 50000);

SELECT set_config('app.current_user_id', '', false);
