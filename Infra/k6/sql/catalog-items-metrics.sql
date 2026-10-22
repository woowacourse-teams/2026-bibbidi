-- Read-only snapshots around catalog-items-test. Subtract before from after per digest.
-- SUM_ROWS_SENT is returned rows; SUM_ROWS_EXAMINED is server work, not the same metric.
-- Compare application digests separately from the labelled collection queries below.
SELECT 'performance_schema', @@performance_schema;
SELECT 'statements_digest', ENABLED
FROM performance_schema.setup_consumers WHERE NAME = 'statements_digest';
SHOW GLOBAL STATUS LIKE 'Performance_schema_digest_lost';
SELECT 'unattributed_digest', COALESCE(SUM(COUNT_STAR), 0)
FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST IS NULL;
SELECT 'catalog_rows', 'categories', COUNT(*) FROM categories;
SELECT 'catalog_rows', 'steps', COUNT(*) FROM steps;
SELECT 'catalog_rows', 'catalog_items', COUNT(*) FROM catalog_items;
SELECT 'catalog_seed_valid', COUNT(*) = 169 AND MIN(id) = 1 AND MAX(id) = 169 FROM catalog_items;
SELECT 'digest', DIGEST, COUNT_STAR, SUM_ROWS_SENT, SUM_ROWS_EXAMINED, DIGEST_TEXT
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = DATABASE()
ORDER BY DIGEST;
