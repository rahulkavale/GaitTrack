do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'gait_dev_sessions'
  ) then
    alter table gait_dev_sessions
      add column if not exists session_context jsonb;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'gait_prod_sessions'
  ) then
    alter table gait_prod_sessions
      add column if not exists session_context jsonb;
  end if;
end $$;
