USE bibbidi;

ALTER TABLE steps
    ADD CONSTRAINT fk_steps_category
        FOREIGN KEY (category_id) REFERENCES categories (id);

ALTER TABLE catalog_items
    ADD CONSTRAINT fk_catalog_items_step
        FOREIGN KEY (step_id) REFERENCES steps (id);
