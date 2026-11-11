CREATE TABLE roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    id        SERIAL PRIMARY KEY,
    role_id   INT          NOT NULL REFERENCES roles(id),
    email     VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL
);

CREATE TABLE sports (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE venues (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(150) NOT NULL,
    city     VARCHAR(100) NOT NULL,
    capacity INT          NOT NULL CHECK (capacity > 0)
);

CREATE TABLE teams (
    id         SERIAL PRIMARY KEY,
    sport_id   INT          NOT NULL REFERENCES sports(id),
    name       VARCHAR(150) NOT NULL,
    city       VARCHAR(100),
    coach_name VARCHAR(150),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by INT REFERENCES users(id),
    is_deleted BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by INT REFERENCES users(id)
);

CREATE TABLE athletes (
    id         SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name  VARCHAR(100) NOT NULL,
    birth_date DATE         NOT NULL,
    email      VARCHAR(255),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by INT REFERENCES users(id),
    is_deleted BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by INT REFERENCES users(id)
);

CREATE TABLE team_members (
    id            SERIAL PRIMARY KEY,
    team_id       INT         NOT NULL REFERENCES teams(id),
    athlete_id    INT         NOT NULL UNIQUE REFERENCES athletes(id),
    jersey_number INT CHECK (jersey_number BETWEEN 0 AND 99)
);

CREATE TABLE referees (
    id        SERIAL PRIMARY KEY,
    sport_id  INT          NOT NULL REFERENCES sports(id),
    full_name VARCHAR(150) NOT NULL
);

CREATE TABLE events (
    id                    SERIAL PRIMARY KEY,
    sport_id              INT          NOT NULL REFERENCES sports(id),
    venue_id              INT          NOT NULL REFERENCES venues(id),
    name                  VARCHAR(200) NOT NULL,
    start_date            DATE         NOT NULL,
    registration_deadline DATE         NOT NULL,
    max_teams             INT          NOT NULL CHECK (max_teams >= 2),
    status                VARCHAR(20)  NOT NULL DEFAULT 'registration'
                          CHECK (status IN ('registration', 'ongoing', 'finished')),
    CHECK (registration_deadline <= start_date)
);

CREATE TABLE event_registrations (
    id            SERIAL PRIMARY KEY,
    event_id      INT         NOT NULL REFERENCES events(id),
    team_id       INT         NOT NULL REFERENCES teams(id),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, team_id)
);

CREATE TABLE matches (
    id           SERIAL PRIMARY KEY,
    event_id     INT         NOT NULL REFERENCES events(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'finished'))
);

CREATE TABLE match_participants (
    match_id INT     NOT NULL REFERENCES matches(id),
    team_id  INT     NOT NULL REFERENCES teams(id),
    is_home  BOOLEAN NOT NULL,
    score    INT CHECK (score >= 0),
    PRIMARY KEY (match_id, team_id)
);

CREATE TABLE match_referees (
    match_id   INT NOT NULL REFERENCES matches(id),
    referee_id INT NOT NULL REFERENCES referees(id),
    PRIMARY KEY (match_id, referee_id)
);

CREATE TABLE ticket_types (
    id       SERIAL PRIMARY KEY,
    event_id INT           NOT NULL REFERENCES events(id),
    name     VARCHAR(50)   NOT NULL,
    price    NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE tickets (
    id             SERIAL PRIMARY KEY,
    ticket_type_id INT          NOT NULL REFERENCES ticket_types(id),
    buyer_email    VARCHAR(255) NOT NULL,
    sold_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sponsors (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE event_sponsors (
    event_id   INT           NOT NULL REFERENCES events(id),
    sponsor_id INT           NOT NULL REFERENCES sponsors(id),
    amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    PRIMARY KEY (event_id, sponsor_id)
);
