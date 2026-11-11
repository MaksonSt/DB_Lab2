CREATE TABLE stat_definitions (
    id       SERIAL PRIMARY KEY,
    sport_id INT          NOT NULL REFERENCES sports(id),
    code     VARCHAR(30)  NOT NULL,
    name     VARCHAR(100) NOT NULL,
    UNIQUE (sport_id, code)
);

CREATE TABLE match_reports (
    id         SERIAL PRIMARY KEY,
    match_id   INT         NOT NULL REFERENCES matches(id),
    attendance INT         CHECK (attendance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE match_report_periods (
    report_id  INT      NOT NULL REFERENCES match_reports(id) ON DELETE CASCADE,
    period_no  SMALLINT NOT NULL CHECK (period_no > 0),
    home_score INT      NOT NULL CHECK (home_score >= 0),
    away_score INT      NOT NULL CHECK (away_score >= 0),
    PRIMARY KEY (report_id, period_no)
);

CREATE TABLE match_report_events (
    id                 BIGSERIAL PRIMARY KEY,
    report_id          INT         NOT NULL REFERENCES match_reports(id) ON DELETE CASCADE,
    seq                INT         NOT NULL,
    period_no          SMALLINT    NOT NULL,
    minute             SMALLINT    NOT NULL CHECK (minute >= 0),
    event_type         VARCHAR(20) NOT NULL
                       CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'substitution',
                                             'foul', 'timeout', 'buzzer_beater')),
    team_id            INT         NOT NULL REFERENCES teams(id),
    athlete_id         INT REFERENCES athletes(id),
    related_athlete_id INT REFERENCES athletes(id),
    points             SMALLINT CHECK (points > 0),
    note               VARCHAR(30),
    UNIQUE (report_id, seq)
);

CREATE TABLE player_match_stats (
    report_id  INT NOT NULL REFERENCES match_reports(id) ON DELETE CASCADE,
    athlete_id INT NOT NULL REFERENCES athletes(id),
    stat_id    INT NOT NULL REFERENCES stat_definitions(id),
    team_id    INT NOT NULL REFERENCES teams(id),
    value      INT NOT NULL CHECK (value >= 0),
    PRIMARY KEY (report_id, athlete_id, stat_id)
);
