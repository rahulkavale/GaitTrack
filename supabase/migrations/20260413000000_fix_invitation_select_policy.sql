drop policy if exists "gait_dev_invitees_see_own" on gait_dev_invitations;

create policy "gait_dev_invitees_see_own"
  on gait_dev_invitations for select
  using (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
