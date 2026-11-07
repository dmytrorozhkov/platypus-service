-- Learner-run only, after accepting and verifying the import in neondb.
-- No password is embedded. Login activation belongs to later private runtime setup.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION 'Unexpected database or setup role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platypus_app') THEN
    RAISE EXCEPTION 'Refusing to reuse or change an existing role';
  END IF;
END
$guard$;
CREATE ROLE platypus_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT CONNECT ON DATABASE neondb TO platypus_app;
GRANT USAGE ON SCHEMA platypus TO platypus_app;
GRANT SELECT ON platypus.organizations, platypus.support_agents, platypus.tickets TO platypus_app;
COMMIT;
