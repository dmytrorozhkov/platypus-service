-- Learner-run only after import verification and runtime-role.sql in the same branch.
-- Set/reset this existing role's password privately in Neon, never in SQL history.
BEGIN;
DO $guard$
DECLARE app pg_roles%ROWTYPE;
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION 'Unexpected setup database or user';
  END IF;
  SELECT * INTO STRICT app FROM pg_roles WHERE rolname = 'platypus_app';
  IF app.rolsuper OR app.rolcreatedb OR app.rolcreaterole OR app.rolreplication
     OR app.rolbypassrls OR app.rolinherit
     OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = app.oid)
     OR EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba = app.oid)
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = app.oid)
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platypus' AND c.relowner=app.oid)
     OR NOT has_schema_privilege('platypus_app','platypus','USAGE')
     OR has_schema_privilege('platypus_app','platypus','CREATE')
     OR has_database_privilege('platypus_app',current_database(),'CREATE') THEN
    RAISE EXCEPTION 'Unexpected application role privileges';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES ('platypus.organizations'), ('platypus.support_agents'), ('platypus.tickets')) AS tables(name)
     WHERE NOT has_table_privilege('platypus_app',name,'SELECT')
        OR has_table_privilege('platypus_app',name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege('platypus_app',name,'INSERT,UPDATE,REFERENCES')) THEN
    RAISE EXCEPTION 'Unexpected business table grants';
  END IF;
END
$guard$;
ALTER ROLE platypus_app LOGIN;
COMMIT;
