CREATE TABLE IF NOT EXISTS general_tolerances (
    id uuid PRIMARY KEY,
    name TEXT NOT NULL,
    -- ± numeric range (in mm or whatever your default unit is)
    range_value NUMERIC(10, 4) NOT NULL,
    -- e.g. 0.05 = ±0.05 mm
    -- percentage tolerance relative to dimension (optional)
    percentage NUMERIC(5, 2),
    -- e.g. 2.5 = ±2.5%
    -- free text for clarification
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE index IF NOT EXISTS idx_general_tolerances_name ON general_tolerances(name);

INSERT INTO general_tolerances (name, range_value, percentage, description) VALUES
("Standard", 0.005, 0, "Standard general tolerance"),
("Precision", 0.002, 5, "Higher precision tolerance"),
("Tight",   0.001, 25, "Custom tolerance as specified by the user");