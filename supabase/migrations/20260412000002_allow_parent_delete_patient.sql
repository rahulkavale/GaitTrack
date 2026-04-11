-- Allow parents to delete a patient (cascades to all related data)
create policy "gait_dev_parents_delete_patients"
  on gait_dev_patients for delete
  using (
    exists (
      select 1 from gait_dev_patient_access
      where gait_dev_patient_access.patient_id = gait_dev_patients.id
      and gait_dev_patient_access.user_id = auth.uid()
      and gait_dev_patient_access.role = 'parent'
    )
  );
