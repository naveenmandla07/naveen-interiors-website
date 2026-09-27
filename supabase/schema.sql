create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  phone text not null check (phone ~ '^(91-)?[6-9][0-9]{9}$'),
  email text not null,
  home text not null,
  budget text not null default '',
  locality text not null,
  message text not null default '',
  consent boolean not null check (consent)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  rating smallint not null check (rating between 1 and 5),
  feedback text not null default '',
  question text not null default '',
  email text
);

create table if not exists public.design_inquiries (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  email text not null,
  room text not null,
  design text not null,
  question text not null,
  consent boolean not null check (consent)
);

alter table public.leads enable row level security;
alter table public.feedback enable row level security;
alter table public.design_inquiries enable row level security;