-- REVIEW ONLY. DO NOT EXECUTE ON PRODUCTION AS PART OF LOCAL REMEDIATION.
-- An approved operator must first confirm a dedicated EKRAM database/public
-- schema, actual object owners, RLS policies and role memberships.
-- psql variables database_name and migration_owner must be supplied privately.
-- This template intentionally contains no password. A LOGIN without password
-- must not be wired to the app until secure credential provisioning is approved.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE ekram_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE :"database_name" TO ekram_runtime;
GRANT USAGE ON SCHEMA public TO ekram_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ekram_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ekram_runtime;
-- Schema lifecycle remains with the separate migration role.
REVOKE ALL ON TABLE public.migrations FROM ekram_runtime;
GRANT SELECT ON TABLE public.migrations TO ekram_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_owner" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ekram_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_owner" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ekram_runtime;
-- Runtime must not belong to azure_pg_admin or any privileged parent role.
-- Do not transfer table ownership or revoke the existing migration/admin role.
COMMIT;
-- Operator verification only; boolean capabilities, no secret values:
SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
       pg_has_role('ekram_runtime', 'azure_pg_admin', 'member') AS azure_admin_member
FROM pg_roles WHERE rolname = 'ekram_runtime';
