-- 0022_contacts_category_open.sql
-- Remove the hardcoded CHECK constraint on contacts.category so the field
-- can hold any value (entity names from the entities table).
alter table contacts drop constraint if exists contacts_category_check;
