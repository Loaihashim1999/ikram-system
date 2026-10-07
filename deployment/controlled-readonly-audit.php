<?php

// Credentials arrive only on stdin, are never written, and are not Laravel env.
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['host'] ?? '') !== 'pg-ikram-prod-399c8d.postgres.database.azure.com'
    || ($input['database'] ?? '') !== 'ikram_prod') {
    throw new RuntimeException('Unapproved audit target');
}
try {
    $db = new PDO('pgsql:host='.$input['host'].';port=5432;dbname=ikram_prod;sslmode=verify-full;sslrootcert=C:/laragon/etc/ssl/cacert.pem;connect_timeout=10',
        $input['username'], $input['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    unset($input);
    $db->exec('BEGIN READ ONLY');
    $db->exec("SET LOCAL statement_timeout = '15s'");
    $db->exec("SET LOCAL lock_timeout = '3s'");
    $query = fn (string $sql) => $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $result = [
        'target' => 'approved Azure ikram_prod',
        'read_only' => $query('SHOW transaction_read_only')[0]['transaction_read_only'],
        'migrations' => $query('SELECT migration, batch FROM migrations ORDER BY migration'),
        'driver_roles' => $query("SELECT role, is_active, count(*) AS count FROM users WHERE role IN ('driver','delivery_driver') GROUP BY role,is_active ORDER BY role,is_active"),
        'driver_entities' => $query('SELECT is_active,count(*) AS count FROM drivers GROUP BY is_active'),
        'migration_role' => $query('SELECT rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user'),
        'schema_ownership' => $query("SELECT tablename,tableowner FROM pg_tables WHERE schemaname='public' AND tablename IN ('users','beneficiaries','support_receipts','notifications','migrations')"),
        'references' => [],
    ];
    $foreignKeys = $query("SELECT ns.nspname AS schema,t.relname AS table,a.attname AS column FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='public.users'::regclass AND ns.nspname='public' AND array_length(c.conkey,1)=1");
    $quote = fn (string $value) => '"'.str_replace('"', '""', $value).'"';
    foreach ($foreignKeys as $ref) {
        $table = $quote($ref['schema']).'.'.$quote($ref['table']);
        $column = $quote($ref['column']);
        $count = $query("SELECT count(*) AS count FROM $table r JOIN users u ON r.$column::text=u.id::text WHERE u.role IN ('driver','delivery_driver')")[0]['count'];
        $result['references'][] = ['table' => $ref['table'], 'column' => $ref['column'], 'count' => $count, 'kind' => 'foreign_key'];
    }
    foreach (['distributions', 'rep_distributions'] as $legacy) {
        if ($query("SELECT to_regclass('public.$legacy') AS name")[0]['name']) {
            $count = $query("SELECT count(*) AS count FROM $legacy r JOIN users u ON r.driver_id::text=u.id::text WHERE u.role IN ('driver','delivery_driver')")[0]['count'];
            $result['references'][] = ['table' => $legacy, 'column' => 'driver_id', 'count' => $count, 'kind' => 'legacy_string'];
        }
    }
    $result['unvalidated_constraints'] = $query("SELECT conrelid::regclass::text AS table,conname FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated");
    $db->exec('ROLLBACK');
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    $category = match (true) {
        str_contains($e->getMessage(), 'certificate') => 'tls_certificate',
        str_contains($e->getMessage(), 'timed out') => 'connection_timeout',
        str_contains($e->getMessage(), 'password authentication failed') => 'authentication_failed',
        str_contains($e->getMessage(), 'does not exist') => 'schema_or_relation_missing',
        str_contains($e->getMessage(), 'permission denied') => 'permission_denied',
        str_contains($e->getMessage(), 'no pg_hba') => 'network_access_denied',
        default => 'connection_or_query_failed',
    };
    fwrite(STDERR, 'Read-only audit failed: '.$category.'; code '.preg_replace('/[^A-Za-z0-9]/', '', (string) $e->getCode()).PHP_EOL);
    exit(1);
}
