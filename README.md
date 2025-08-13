# Klientų užrašymas – su prisijungimu (Supabase Auth), LT kalendoriumi, statusais ir filtrais

Šiame ZIP viskas paruošta: login UI, RLS parama (per SQL), LT `DateField`, 24h laikas, „Atvyko/Neatvyko“, statistikos filtrai ir mobilus išdėstymas.

## 1) Supabase Auth (prisijungimas)
- **Authentication → Users → Add user**: sukurk savo (ir draugės) paskyras.
- **Authentication → Providers → Email**: gali **išjungti „Allow new users to sign up“**, kad niekas pats neužsiregistruotų.

## 2) RLS (Row Level Security) politikos
SQL Editor → New query → paleisk:
```sql
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create policy if not exists "clients select (auth)" on public.clients
for select using (auth.role() = 'authenticated');
create policy if not exists "clients insert (auth)"  on public.clients
for insert with check (auth.role() = 'authenticated');
create policy if not exists "clients update (auth)"  on public.clients
for update using (auth.role() = 'authenticated');
create policy if not exists "clients delete (auth)"  on public.clients
for delete using (auth.role() = 'authenticated');

create policy if not exists "services select (auth)" on public.services
for select using (auth.role() = 'authenticated');
create policy if not exists "services insert (auth)"  on public.services
for insert with check (auth.role() = 'authenticated');
create policy if not exists "services update (auth)"  on public.services
for update using (auth.role() = 'authenticated');
create policy if not exists "services delete (auth)"  on public.services
for delete using (auth.role() = 'authenticated');

create policy if not exists "appointments select (auth)" on public.appointments
for select using (auth.role() = 'authenticated');
create policy if not exists "appointments insert (auth)"  on public.appointments
for insert with check (auth.role() = 'authenticated');
create policy if not exists "appointments update (auth)"  on public.appointments
for update using (auth.role() = 'authenticated');
create policy if not exists "appointments delete (auth)"  on public.appointments
for delete using (auth.role() = 'authenticated');
```

## 3) Statuso stulpelis (jei dar nedėtas)
```sql
alter table public.appointments
  add column if not exists status text check (status in ('scheduled','attended','no_show')) default 'scheduled';

update public.appointments
  set status = 'scheduled'
  where status is null;
```

## 4) Aplinka `.env.local`
```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```

## 5) Paleidimas
```
npm install
npm start
```

## 6) Deploy į Vercel
Nustatyk env kintamuosius (aukščiau). Gavusi nuoroda bus apsaugota prisijungimu + RLS.
