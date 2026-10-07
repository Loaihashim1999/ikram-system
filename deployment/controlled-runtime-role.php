<?php

// One additive principal only. No existing role, ownership, PUBLIC or RLS changes.
if (getenv('DB_HOST') !== 'pg-ikram-prod-399c8d.postgres.database.azure.com'
    || getenv('DB_DATABASE') !== 'ikram_prod' || getenv('DB_USERNAME') !== 'ikramadmin') {
    throw new RuntimeException('Unapproved role bootstrap target');
}
$role = 'ekram_runtime_candidate';
$tables = explode(' ', 'audit_logs baskets beneficiaries beneficiary_documents beneficiary_policy_evaluations beneficiary_policy_versions cache cache_locks categories communication_messages communication_template_versions daily_beneficiaries daily_beneficiary_documents daily_inventory_items daily_inventory_movements daily_receiving_transactions delivery_orders dependents distributions document_verifications driver_assignment_tasks driver_assignments drivers failed_jobs inventory_items inventory_movements job_batches jobs medical_evidence neighborhood_reps notifications organizations password_reset_challenges password_reset_tokens personal_access_tokens pickup_locations policy_application_run_items policy_application_runs policy_decisions receipt_challenges receipts rep_distribution_proofs rep_distributions sessions settings social_assessments staff staff_dependents staff_distributions staff_members support_distribution_items support_distributions support_receipts system_initializations users');
$db = new PDO('pgsql:host='.getenv('DB_HOST').';port=5432;dbname=ikram_prod;sslmode=verify-full;sslrootcert=/etc/ssl/certs/ca-certificates.crt', getenv('DB_USERNAME'), getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$quote = fn (string $identifier) => '"'.str_replace('"', '""', $identifier).'"';
$db->beginTransaction();
try {
    $db->exec("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    $exists = $db->prepare('SELECT 1 FROM pg_roles WHERE rolname=?');
    $exists->execute([$role]);
    if ($exists->fetchColumn()) {
        throw new RuntimeException('Candidate principal already exists; refuse modification');
    }
    $inventory = $db->query("SELECT c.relname,r.rolname AS owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname")->fetchAll(PDO::FETCH_ASSOC);
    $actual = array_column($inventory, 'relname');
    $expected = [...$tables, 'migrations'];
    sort($expected);
    if ($actual !== $expected) {
        throw new RuntimeException('Table inventory drift');
    }
    foreach ($inventory as $table) {
        if ($table['owner'] !== 'ikramadmin' || $table['relrowsecurity'] || $table['relforcerowsecurity']) {
            throw new RuntimeException('Ownership/RLS drift');
        }
    }
    $database = $db->query('SELECT r.rolname AS owner,d.datacl FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database()')->fetch(PDO::FETCH_ASSOC);
    $schema = $db->query("SELECT r.rolname AS owner,n.nspacl::text AS acl FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public'")->fetch(PDO::FETCH_ASSOC);
    if ($database['owner'] !== 'ikramadmin' || $database['datacl'] !== null
        || $schema['owner'] !== 'azure_pg_admin' || $schema['acl'] !== '{azure_pg_admin=UC/azure_pg_admin,=U/azure_pg_admin}'
        || $db->query("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef")->fetchColumn() != 0
        || $db->query("SELECT count(*) FROM pg_policies WHERE schemaname='public'")->fetchColumn() != 0) {
        throw new RuntimeException('Approved privilege footprint drift');
    }
    $endpoint = getenv('IDENTITY_ENDPOINT');
    $header = getenv('IDENTITY_HEADER');
    if (! $endpoint || ! $header) {
        throw new RuntimeException('Managed identity unavailable');
    }
    $fetch = function (string $url, array $headers): array {
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($status !== 200 || ! is_string($body)) {
            throw new RuntimeException('Secure credential lookup failed');
        }

        return json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    };
    $identity = $fetch($endpoint.'?api-version=2019-08-01&resource='.urlencode('https://vault.azure.net').'&client_id=caa95cf6-c7a0-4d32-958a-06445d7a93e5', ['X-IDENTITY-HEADER: '.$header]);
    $secret = $fetch('https://kv-ikram-prod-399c.vault.azure.net/secrets/ekram-candidate-db-password?api-version=7.4', ['Authorization: Bearer '.$identity['access_token']]);
    $password = $secret['value'] ?? '';
    unset($identity, $secret, $header);
    if (! preg_match('/^[a-f0-9]{64}$/D', $password)) {
        throw new RuntimeException('Invalid generated ASCII credential');
    }
    // Store a SCRAM verifier: plaintext password never enters SQL text.
    $salt = random_bytes(16);
    $iterations = 4096;
    $salted = hash_pbkdf2('sha256', $password, $salt, $iterations, 32, true);
    unset($password);
    $stored = hash('sha256', hash_hmac('sha256', 'Client Key', $salted, true), true);
    $server = hash_hmac('sha256', 'Server Key', $salted, true);
    unset($salted);
    $verifier = 'SCRAM-SHA-256$'.$iterations.':'.base64_encode($salt).'$'.base64_encode($stored).':'.base64_encode($server);
    $db->exec('CREATE ROLE '.$quote($role).' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '.$db->quote($verifier));
    unset($verifier);
    $db->exec('GRANT CONNECT ON DATABASE ikram_prod TO '.$quote($role));
    $db->exec('GRANT USAGE ON SCHEMA public TO '.$quote($role));
    $db->exec('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE '.implode(',', array_map(fn ($table) => 'public.'.$quote($table), $tables)).' TO '.$quote($role));
    $db->exec('GRANT SELECT ON TABLE public.migrations TO '.$quote($role));
    $sequences = $db->query("SELECT DISTINCT s.relname AS name, sr.rolname AS owner,t.relname AS table_name FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace JOIN pg_roles sr ON sr.oid=s.relowner JOIN pg_depend d ON d.objid=s.oid AND d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') AND d.refobjsubid>0 JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid AND NOT a.attisdropped WHERE s.relkind='S' AND n.nspname='public' AND tn.nspname='public' AND t.relkind IN ('r','p')")->fetchAll(PDO::FETCH_ASSOC);
    $granted = [];
    foreach ($sequences as $sequence) {
        if (! in_array($sequence['table_name'], $tables, true)) {
            continue;
        }
        if ($sequence['owner'] !== 'ikramadmin') {
            throw new RuntimeException('Unexpected sequence ownership');
        }
        $db->exec('GRANT USAGE,SELECT ON SEQUENCE public.'.$quote($sequence['name']).' TO '.$quote($role));
        $granted[] = $sequence['name'];
    }
    $flags = $db->query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname='ekram_runtime_candidate'")->fetch(PDO::FETCH_ASSOC);
    if (in_array(true, $flags, true)
        || $db->query("SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='ekram_runtime_candidate')")->fetchColumn() != 0
        || $db->query("SELECT has_schema_privilege('ekram_runtime_candidate','public','CREATE')")->fetchColumn()) {
        throw new RuntimeException('Effective elevated privilege detected');
    }
    foreach (['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as $privilege) {
        if ($db->query("SELECT has_table_privilege('ekram_runtime_candidate','public.migrations',".$db->quote($privilege).')')->fetchColumn()) {
            throw new RuntimeException('Effective migration write privilege');
        }
    }
    foreach ($tables as $table) {
        foreach (['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as $privilege) {
            if (! $db->query("SELECT has_table_privilege('ekram_runtime_candidate',".$db->quote('public.'.$table).','.$db->quote($privilege).')')->fetchColumn()) {
                throw new RuntimeException('Missing effective application privilege');
            }
        }
    }
    foreach ($granted as $sequence) {
        foreach (['USAGE', 'SELECT'] as $privilege) {
            if (! $db->query("SELECT has_sequence_privilege('ekram_runtime_candidate',".$db->quote('public.'.$sequence).','.$db->quote($privilege).')')->fetchColumn()) {
                throw new RuntimeException('Missing sequence privilege');
            }
        }
    }
    $db->commit();
    echo json_encode(['created_role' => $role, 'application_tables' => count($tables), 'migration_ledger' => 'SELECT_ONLY', 'sequences' => $granted, 'existing_roles_modified' => false, 'credential_disclosed' => false]);
} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    // No raw errors: server diagnostics may include credential-verifier SQL.
    fwrite(STDERR, "Bounded candidate principal provisioning failed; no diagnostic credential output\n");
    exit(1);
}
