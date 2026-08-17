-- Paridad de RLS con producción. Prod tiene ROW LEVEL SECURITY activado (SIN políticas) en estas 44
-- tablas — se activó a mano en el dashboard; las migraciones no lo hacían. La app opera con service_role,
-- que IGNORA RLS, así que activar sin políticas no rompe nada (prod ya funciona exactamente así).
-- Esto iguala un build nuevo con prod y deja la base correcta para la fase de Público con Supabase Auth
-- (donde sí se añadirán políticas + created_by). Idempotente: activar RLS sobre una tabla ya protegida
-- es no-op, así que es seguro sobre prod (donde ya está) y sobre un build nuevo (donde la enciende).
--
-- Las tablas que YA activaban RLS en migraciones previas (entities, raw_captures, tasks, daily_logs,
-- memory_chunks, audit_log, journal_entries, finance_income_items, finance_monthly_state, notes) NO se
-- repiten aquí. Esta lista es exactamente el delta que el db diff encontró.
alter table contacts                       enable row level security;
alter table event_exceptions               enable row level security;
alter table finance_balance                enable row level security;
alter table finance_card_charges           enable row level security;
alter table finance_card_confirmations     enable row level security;
alter table finance_cards                  enable row level security;
alter table finance_commitments            enable row level security;
alter table finance_envelopes              enable row level security;
alter table finance_movements              enable row level security;
alter table habit_completions              enable row level security;
alter table habits                         enable row level security;
alter table lolo_memory                    enable row level security;
alter table lolo_messages                  enable row level security;
alter table publico_clip_sync              enable row level security;
alter table publico_config                 enable row level security;
alter table publico_contenedor_saldos      enable row level security;
alter table publico_costos                 enable row level security;
alter table publico_ingresos               enable row level security;
alter table publico_notas                  enable row level security;
alter table publico_poster_sync            enable row level security;
alter table publico_previsto_pagos         enable row level security;
alter table publico_previstos              enable row level security;
alter table publico_propina_repartos       enable row level security;
alter table publico_propina_sync           enable row level security;
alter table publico_propinas               enable row level security;
alter table publico_traspasos              enable row level security;
alter table publico_ventas                 enable row level security;
alter table ticket_items                   enable row level security;
alter table ticket_product_aliases         enable row level security;
alter table ticket_scans                   enable row level security;
alter table ticket_supplier_aliases        enable row level security;
alter table uptown_balance                 enable row level security;
alter table uptown_cortes_bak_0051         enable row level security;
alter table uptown_extra_expenses          enable row level security;
alter table uptown_extra_income            enable row level security;
alter table uptown_fixed_expenses          enable row level security;
alter table uptown_nomina                  enable row level security;
alter table uptown_reconciliations_bak_0051 enable row level security;
alter table uptown_renter_counts           enable row level security;
alter table uptown_renters                 enable row level security;
alter table uptown_rents                   enable row level security;
alter table uptown_valet_config            enable row level security;
alter table uptown_valet_config_bak_0057   enable row level security;
alter table uptown_valet_payments          enable row level security;
