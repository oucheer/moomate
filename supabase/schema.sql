-- MooMate MVP schema
create extension if not exists "uuid-ossp";

create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  theme text not null default '今晚牛搭子',
  status text not null default 'active',
  capacity int not null default 20,
  host_token text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table if not exists participants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  nickname text not null,
  avatar text not null default 'cow',
  gender text not null default 'secret',
  gender_preference text not null default 'any',
  tags jsonb not null default '[]',
  photo_path text,
  photo_uploaded boolean not null default false,
  status text not null default 'waiting',
  match_id uuid,
  answers jsonb,
  ai_profile jsonb,
  is_virtual boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  participant_a uuid references participants(id) on delete cascade,
  participant_b uuid references participants(id) on delete cascade,
  status text not null default 'pending',
  score numeric not null default 0,
  reason text not null default '',
  confirmed_a boolean not null default false,
  confirmed_b boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists games (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  type text not null default '默契挑战',
  status text not null default 'active',
  questions jsonb not null default '[]',
  answers jsonb not null default '{}',
  review text,
  card jsonb,
  created_at timestamptz default now()
);

alter table rooms enable row level security;
alter table participants enable row level security;
alter table matches enable row level security;
alter table games enable row level security;

create policy "public read rooms" on rooms for select using (true);
create policy "public read participants" on participants for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read games" on games for select using (true);

-- writes should go through service-role API routes
