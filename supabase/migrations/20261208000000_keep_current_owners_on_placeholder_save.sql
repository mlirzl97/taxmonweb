-- A profile save that carries a placeholder never clears a current owner or
-- placement.
--
-- The dossier merges the last saved snapshot over the live read model, so a
-- snapshot that still said "Unassigned" / "Unresolved" could be re-saved after
-- owners were assigned. The sync trigger read that as "remove the owner" and
-- closed the current assignments. Now, before the version is written, any
-- placeholder role, Cluster or Tower is filled from the Registration Unit's
-- current assignment and scope, so the snapshot states the facts in force and
-- the sync trigger sees no change. Assigning someone new still works exactly
-- as before; only the placeholder no longer means "remove".

create or replace function public.canonicalize_tax_profile_assignment_labels()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  role_key text;
  submitted_id text;
  submitted_label text;
  canonical_name text;
  current_owner record;
  current_unit record;
  placeholders constant text[] := array['', 'unassigned', 'unresolved', 'needs review', 'not configured'];
begin
  if new.assignment_data is null or jsonb_typeof(new.assignment_data) <> 'object' then
    return new;
  end if;
  foreach role_key in array array['preparer', 'checker', 'reviewer'] loop
    submitted_id := new.assignment_data ->> (role_key || 'UserId');
    submitted_label := lower(trim(coalesce(new.assignment_data ->> role_key, '')));
    canonical_name := null;
    if coalesce(submitted_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select app_user.display_name into canonical_name from public.app_users app_user where app_user.id = submitted_id::uuid;
      if canonical_name is not null then
        new.assignment_data := jsonb_set(new.assignment_data, array[role_key], to_jsonb(canonical_name));
      end if;
    elsif submitted_label = any (placeholders) then
      -- A placeholder means "no change": keep the person currently in the role.
      select assignment.user_id, app_user.display_name into current_owner
      from public.registration_unit_team_assignments assignment
      join public.app_users app_user on app_user.id = assignment.user_id
      where assignment.registration_unit_id = new.registration_unit_id
        and assignment.assignment_role = role_key
        and assignment.user_id is not null
        and assignment.effective_to is null
      order by assignment.effective_from desc, assignment.assigned_at desc
      limit 1;
      if found then
        new.assignment_data := new.assignment_data
          || jsonb_build_object(role_key, current_owner.display_name, role_key || 'UserId', current_owner.user_id::text);
      end if;
    end if;
  end loop;

  -- Likewise, a placeholder Cluster or Tower keeps the unit's current placement.
  if lower(trim(coalesce(new.assignment_data ->> 'tower', ''))) = any (placeholders)
     and lower(trim(coalesce(new.assignment_data ->> 'cluster', ''))) = any (placeholders) then
    select unit.name, unit.unit_kind, parent_unit.name as parent_name, parent_unit.unit_kind as parent_kind into current_unit
    from public.registration_unit_scope_assignments scope
    join public.organization_units unit on unit.id = scope.organization_unit_id
    left join public.organization_units parent_unit on parent_unit.id = unit.parent_id
    where scope.registration_unit_id = new.registration_unit_id
      and scope.effective_to is null
      and unit.unit_kind in ('cluster', 'tower')
    order by scope.effective_from desc, scope.assigned_at desc
    limit 1;
    if found then
      if current_unit.unit_kind = 'tower' then
        new.assignment_data := new.assignment_data || jsonb_build_object('tower', current_unit.name);
        if current_unit.parent_kind = 'cluster' then
          new.assignment_data := new.assignment_data || jsonb_build_object('cluster', current_unit.parent_name);
        end if;
      else
        new.assignment_data := new.assignment_data || jsonb_build_object('cluster', current_unit.name);
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.canonicalize_tax_profile_assignment_labels() from public, anon, authenticated;
