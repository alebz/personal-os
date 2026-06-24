-- Payment method column for rents and fixed expenses
alter table uptown_rents add column if not exists method text not null default 'cash';
alter table uptown_fixed_expenses add column if not exists method text not null default 'cash';
