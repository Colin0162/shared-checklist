-- ============================================================
--  014: whoami — 토큰이 유효한 로그인 사용자인지 확인(이름 반환)
--  - 서버(Vercel 함수)가 'AI 항목 만들기' 요청자를 검증하는 용도.
--    로그인 안 한 사람이 AI 기능(=비용)을 쓰지 못하게 막는다.
--  - 유효하면 이름, 아니면 null. (내부용 _whoami 와 달리 anon 실행 허용)
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

create or replace function public.whoami(p_token text)
returns text language sql security definer set search_path = public as $fn$
  select u.name from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token
    and s.created_at > now() - interval '30 days'
    and u.status = 'approved';
$fn$;
grant execute on function public.whoami(text) to anon, authenticated;

insert into public.schema_migrations (version) values ('014_whoami_public')
on conflict (version) do nothing;
