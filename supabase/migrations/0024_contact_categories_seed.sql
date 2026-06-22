-- 0024_contact_categories_seed.sql
-- Seed default contact categories as entities with type='contact_category'.
-- CRM project entities (type='crm') stay separate.
INSERT INTO entities (type, name)
SELECT 'contact_category', v.name
FROM (VALUES
  ('Familia'),
  ('Círculo cercano'),
  ('Círculo extendido'),
  ('Proveedores'),
  ('Clientes')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM entities WHERE type = 'contact_category' AND name = v.name
);
