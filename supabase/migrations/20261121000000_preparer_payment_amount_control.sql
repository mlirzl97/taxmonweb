-- The amount is captured once during Preparer certification and is then an
-- evidentiary fact, not an editable payment-profile field.
alter table public.generated_work_evidence
  add column if not exists amount numeric(18, 2);

alter table public.generated_work_evidence
  drop constraint if exists generated_work_evidence_amount_check;

alter table public.generated_work_evidence
  add constraint generated_work_evidence_amount_check
  check (amount is null or amount >= 0);

create or replace function public.guard_preparer_payment_amount()
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
      and ((old.current_gate is distinct from 'preparer' and old.lifecycle_stage <> 'preparation') or old.preparer_user_id is distinct from auth.uid()) then
      raise exception using errcode = '42501', message = 'Only the assigned Preparer can record the amount to pay.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_preparer_payment_amount on public.generated_compliance_work;
create trigger guard_preparer_payment_amount
before update of payment_amount on public.generated_compliance_work
for each row execute function public.guard_preparer_payment_amount();

create or replace function public.record_payment_amount_evidence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.payment_amount is distinct from old.payment_amount and new.payment_amount is not null then
    insert into public.generated_work_evidence (generated_work_id, step_code, evidence_kind, reference, amount, result_status, note, actor_id)
    values (new.id, 'prepare', 'payment', 'Amount to pay captured at Preparer certification', new.payment_amount, 'reported', 'Payment amount is a return evidence fact; the processing event records the actor and time.', coalesce(auth.uid(), new.updated_by));
  end if;
  return new;
end;
$$;

drop trigger if exists record_payment_amount_evidence on public.generated_compliance_work;
create trigger record_payment_amount_evidence
after update of payment_amount on public.generated_compliance_work
for each row execute function public.record_payment_amount_evidence();
