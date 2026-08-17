-- journal_entries_created_idx (índice de performance sobre created_at DESC) existe en las migraciones
-- pero se borró A MANO en producción. Restáuralo para paridad. No-op en un build nuevo (ya lo crea la
-- migración de journal) y en prod una vez recreado.
create index if not exists journal_entries_created_idx on journal_entries (created_at desc);
