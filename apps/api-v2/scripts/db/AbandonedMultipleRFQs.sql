CREATE OR REPLACE FUNCTION abandon_rfq_parts(
        p_part_ids UUID [],
        p_user_id UUID,
        p_reason TEXT
    ) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_part_id UUID;
v_count INTEGER := 0;
BEGIN FOREACH v_part_id IN ARRAY p_part_ids LOOP PERFORM abandon_rfq_part(v_part_id, p_user_id, p_reason);
v_count := v_count + 1;
END LOOP;
RETURN v_count;
END;
$$;