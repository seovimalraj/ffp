CREATE TABLE rfq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_code VARCHAR(20) UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  final_price numeric(10, 2),
  status VARCHAR(50) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE rfq_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  cad_file_url VARCHAR(255) NOT NULL,
  cad_file_type VARCHAR(50) NOT NULL,
  snapshot_2d_url TEXT,
  material VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  tolerance VARCHAR(50) NOT NULL,
  finish VARCHAR(50) NOT NULL,
  threads VARCHAR(50),
  inspection VARCHAR(50),
  notes TEXT,
  lead_time_type VARCHAR(50) NOT NULL,
  lead_time INT NOT NULL,
  delivery_date TIMESTAMP,
  geometry JSONB,
  pricing JSONB,
  certificates JSONB,
  is_archived BOOLEAN DEFAULT FALSE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  final_price numeric(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE part_drawing_2d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  rfq_part_id UUID NOT NULL REFERENCES rfq_parts(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE SEQUENCE rfq_number_seq START 1 INCREMENT 1;
CREATE OR REPLACE FUNCTION generate_rfq_code() RETURNS TRIGGER AS $$
DECLARE seq_value BIGINT;
BEGIN IF NEW.rfq_code IS NULL THEN seq_value := nextval('rfq_number_seq');
NEW.rfq_code := 'FRI_RFQ_' || LPAD(seq_value::TEXT, 8, '0');
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER rfq_code_trigger BEFORE
INSERT ON rfq FOR EACH ROW EXECUTE FUNCTION generate_rfq_code();
-- 
-- -- RFQ Parts generate code
--
CREATE SEQUENCE rfq_part_code_seq START 7 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- -- RFQ Parts generate code trigger
--
CREATE OR REPLACE FUNCTION set_rfq_part_code() RETURNS TRIGGER AS $$ BEGIN IF NEW.part_code IS NULL THEN NEW.part_code := 'FRI_PART_' || LPAD(nextval('rfq_part_code_seq')::TEXT, 8, '0');
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- RFQ Parts Trigger
CREATE TRIGGER trg_set_rfq_part_code BEFORE
INSERT ON rfq_parts FOR EACH ROW EXECUTE FUNCTION set_rfq_part_code();