# PIA Admin Panel — Supabase

1. In Supabase SQL Editor, run `supabase/schema.sql` once.
2. In Authentication > Users, create the first admin email/password.
3. Copy that Auth user's UUID and run:

insert into public.admins(id,name,email,role,status) values ('AUTH_USER_UUID','Main Admin','YOUR_EMAIL','super_admin','active');

4. Upload the files in this folder to the root of the GitHub Pages repository.
5. Open `login.html` and sign in with the Supabase Auth email/password.

Only the Supabase publishable key is used in the browser. Never expose a secret/service_role key.
