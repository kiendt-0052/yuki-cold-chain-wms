-- Demo accounts for reviewers (test values only — see README.md).
-- Passwords are bcrypt-hashed by pgcrypto; the app verifies them with bcryptjs.
insert into app_users (login_id, display_name, role, password_hash) values
  ('admin',      '管理者 デモ',      'admin',      extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('receiving',  '入荷担当 デモ',    'receiving',  extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('dispatcher', '配送計画者 デモ',  'dispatcher', extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('qa',         '品質管理 デモ',    'qa',         extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf'))),
  ('auditor',    '監査者 デモ',      'auditor',    extensions.crypt('YukiDemo#2026', extensions.gen_salt('bf')))
on conflict (login_id) do update
  set password_hash = excluded.password_hash, role = excluded.role, display_name = excluded.display_name,
      active = true;
