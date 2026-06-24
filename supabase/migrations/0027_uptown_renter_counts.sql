create table if not exists uptown_renter_counts (
  renter       text primary key,
  paid_count   int  not null default 0,
  total_months int  not null default 12
);
