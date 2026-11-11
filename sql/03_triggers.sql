CREATE FUNCTION trg_fn_set_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    NEW.updated_by := fn_current_user_id();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teams_audit    BEFORE INSERT OR UPDATE ON teams    FOR EACH ROW EXECUTE FUNCTION trg_fn_set_audit_fields();
CREATE TRIGGER trg_athletes_audit BEFORE INSERT OR UPDATE ON athletes FOR EACH ROW EXECUTE FUNCTION trg_fn_set_audit_fields();

CREATE FUNCTION trg_fn_check_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_event events%ROWTYPE;
    v_team  teams%ROWTYPE;
BEGIN
    SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Подію id=% не знайдено', NEW.event_id;
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = NEW.team_id AND NOT is_deleted;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Команду id=% не знайдено', NEW.team_id;
    END IF;

    IF v_event.status <> 'registration' OR current_date > v_event.registration_deadline THEN
        RAISE EXCEPTION 'Реєстрацію на подію "%" закрито', v_event.name;
    END IF;

    IF v_team.sport_id <> v_event.sport_id THEN
        RAISE EXCEPTION 'Команда "%" не відповідає виду спорту події "%"', v_team.name, v_event.name;
    END IF;

    IF fn_event_free_slots(NEW.event_id) <= 0 THEN
        RAISE EXCEPTION 'На подію "%" немає вільних місць', v_event.name;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_registrations_check
    BEFORE INSERT ON event_registrations
    FOR EACH ROW EXECUTE FUNCTION trg_fn_check_registration();
