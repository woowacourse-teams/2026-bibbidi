-- Applies to databases created before TSK-23.
-- Newly created databases already get this column definition from bibbidi_mvp_schema.sql.
-- Checklist items that a user adds directly may not belong to any category.

USE bibbidi;

ALTER TABLE checklist_items MODIFY category_id BIGINT NULL;
