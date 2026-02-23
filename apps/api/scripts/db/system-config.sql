CREATE TABLE system_config (key TEXT PRIMARY KEY, value TEXT, description text);
alter table system_config
add column type text DEFAULT 'string';