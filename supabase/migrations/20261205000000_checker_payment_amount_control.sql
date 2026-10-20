-- Payment amount is a Checker-certified return fact, not a Preparer correction.

drop trigger if exists guard_preparer_payment_amount on public.generated_compliance_work;
drop function if exists public.guard_preparer_payment_amount();

create or replace function public.guard_checker_payment_amount()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.payment_amount is distinct from old.payment_amount then
    if old.payment_amount is not null then
      raise exception using errcode = '42501', message = 'The amount to pay is already recorded and cannot be edited.';
    end if;
    if new.payment_amount is not null and old.payment_applicability <> 'required' then
      raise exception using errcode = '22023', message = 'Resolve payment applicability before recording the amount to pay.';
    end if;
    if new.payment_amount is not null
      and not (public.has_active_capability('PerformElevatedOverride') or public.has_active_capability('MaintainGeneratedComplianceWork'))
      and ((old.current_gate is distinct from 'checker' and old.lifecycle_stage <> 'checking') or old.checker_user_id is distinct from auth.uid()) then
      raise exception using errcode = '42501', message = 'Only the assigned Checker can record the amount to pay.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_checker_payment_amount on public.generated_compliance_work;
create trigger guard_checker_payment_amount
before update of payment_amount on public.generated_compliance_work
for each row execute function public.guard_checker_payment_amount();

revoke execute on function public.guard_checker_payment_amount() from public, anon, authenticated;

create or replace function public.record_payment_amount_evidence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.payment_amount is distinct from old.payment_amount and new.payment_amount is not null then
    insert into public.generated_work_evidence (generated_work_id, step_code, evidence_kind, reference, amount, result_status, note, actor_id)
    values (new.id, 'check', 'payment', 'Amount to pay captured at Checker certification', new.payment_amount, 'reported', 'Payment amount is a return evidence fact; the processing event records the actor and time.', coalesce(auth.uid(), new.updated_by));
  end if;
  return new;
end;
$$;

revoke execute on function public.record_payment_amount_evidence() from public, anon, authenticated;

drop trigger if exists record_payment_amount_evidence on public.generated_compliance_work;
create trigger record_payment_amount_evidence
after update of payment_amount on public.generated_compliance_work
for each row execute function public.record_payment_amount_evidence();

-- Refresh the live command boundary so Checker certification records the amount atomically.
do $$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'record_generated_work_command'
     and p.oid = 'public.record_generated_work_command(uuid, text, jsonb, text)'::regprocedure;

  if definition is null then
    raise exception 'record_generated_work_command is not available to refresh';
  end if;

  definition := replace(definition,
    '    if is_elevated and override_reason is null then raise exception using errcode = ''22023'', message = ''An elevated override reason is required.''; end if;

    insert into public.generated_work_gate_attempts',
    '    if is_elevated and override_reason is null then raise exception using errcode = ''22023'', message = ''An elevated override reason is required.''; end if;
    if role_value = ''checker'' and decision_value <> ''return'' and work.payment_applicability = ''required'' then
      if payment_amount_value is null or payment_amount_value < 0 then
        raise exception using errcode = ''22023'', message = ''Record the amount to pay before certifying the Checker gate.'';
      end if;
      update public.generated_compliance_work
      set payment_amount = payment_amount_value, updated_at = now(), updated_by = actor_id
      where id = p_work_id;
    end if;

    insert into public.generated_work_gate_attempts');

  if position('Record the amount to pay before certifying the Checker gate.' in definition) = 0 then
    raise exception 'Unable to refresh record_generated_work_command for Checker payment amount control';
  end if;
  execute definition;
end;
$$;
