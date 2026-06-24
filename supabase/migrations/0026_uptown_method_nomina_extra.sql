alter table uptown_nomina add column if not exists method text not null default 'cash';
alter table uptown_extra_income add column if not exists method text not null default 'cash';
alter table uptown_extra_expenses add column if not exists method text not null default 'cash';
