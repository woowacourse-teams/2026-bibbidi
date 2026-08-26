DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS checklists;
DROP TABLE IF EXISTS catalog_items;
DROP TABLE IF EXISTS steps;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_order INT NOT NULL
);

CREATE TABLE steps (
    id BIGINT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    display_order INT NOT NULL
);

CREATE TABLE catalog_items (
    id BIGINT PRIMARY KEY,
    step_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    display_order INT NOT NULL,
    essential BOOLEAN NOT NULL
);

CREATE TABLE checklists (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL
);

CREATE TABLE checklist_items (
    id BIGINT PRIMARY KEY,
    checklist_id BIGINT NOT NULL,
    source_catalog_item_id BIGINT
);
