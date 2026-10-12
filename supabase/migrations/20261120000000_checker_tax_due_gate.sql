-- Capture the Checker-certified tax due amount as gate evidence.
alter table public.generated_work_gate_attempts
  add column if not exists tax_due_amount numeric;

alter table public.generated_work_gate_attempts
  drop constraint if exists generated_work_gate_attempts_tax_due_amount_check;

alter table public.generated_work_gate_attempts
  add constraint generated_work_gate_attempts_tax_due_amount_check
  check (tax_due_amount is null or tax_due_amount >= 0);

create or replace function public.capture_checker_tax_due_amount()
returns trigger
language plpgsql
as $$
declare
  tax_due jsonb := new.answers -> 'taxDueAmount';
begin
  if new.role = 'checker' and new.decision <> 'return' then
    if tax_due is null or jsonb_typeof(tax_due) <> 'number' then
      raise exception using errcode = '22023', message = 'A non-negative tax due amount is required for Checker certification.';
    end if;
    new.tax_due_amount := (tax_due #>> '{}')::numeric;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_checker_tax_due_amount on public.generated_work_gate_attempts;
create trigger capture_checker_tax_due_amount
before insert on public.generated_work_gate_attempts
for each row execute function public.capture_checker_tax_due_amount();
