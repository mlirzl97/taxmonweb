-- Keep externally meaningful return facts separate from the generic evidence reference.
-- Files remain outside TaxMonWeb; these are dates and names used for control reporting.

alter table public.generated_work_evidence
  add column if not exists acknowledged_on date,
  add column if not exists validated_on date,
  add column if not exists attachment_name text;

-- Refresh the command boundary for databases that already applied the original
-- Work migration before these structured fields were introduced.
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
     and pg_get_function_identity_arguments(p.oid) = 'uuid, text, jsonb, text';

  if definition is null or position('acknowledged_on_value' in definition) > 0 then
    return;
  end if;

  definition := replace(definition,
    '  payment_amount_value numeric := nullif(trim(p_payload ->> ''paymentAmount''), '''')::numeric;',
    '  payment_amount_value numeric := nullif(trim(p_payload ->> ''paymentAmount''), '''')::numeric;
  acknowledged_on_value date := nullif(trim(p_payload ->> ''acknowledgedOn''), '''')::date;
  validated_on_value date := nullif(trim(p_payload ->> ''validatedOn''), '''')::date;
  attachment_name_value text := nullif(trim(p_payload ->> ''attachmentName''), '''');');
  definition := replace(definition,
    '    if step_code_value = ''payment-confirmation'' and status_value = ''complete'' and work.payment_amount is null then raise exception using errcode = ''22023'', message = ''Record the payment amount before confirming payment.''; end if;',
    '    if step_code_value = ''payment-confirmation'' and status_value = ''complete'' and work.payment_amount is null then raise exception using errcode = ''22023'', message = ''Record the payment amount before confirming payment.''; end if;
    if step_code_value = ''esubmission'' and status_value = ''complete'' and (acknowledged_on_value is null or validated_on_value is null) then raise exception using errcode = ''22023'', message = ''Record the BIR acknowledgment and validation dates before completing eSubmission.''; end if;');
  definition := replace(definition,
    'insert into public.generated_work_evidence (generated_work_id, step_code, evidence_kind, reference, external_date, external_reference, external_channel, sharepoint_url, result_status, note, actor_id)',
    'insert into public.generated_work_evidence (generated_work_id, step_code, evidence_kind, reference, external_date, acknowledged_on, validated_on, attachment_name, external_reference, external_channel, sharepoint_url, result_status, note, actor_id)');
  definition := replace(definition,
    'evidence_reference, nullif(p_payload ->> ''externalDate'', '''')::date, nullif(trim(p_payload ->> ''externalReference''), ''''), nullif(trim(p_payload ->> ''externalChannel''), ''''), nullif(trim(p_payload ->> ''sharepointUrl''), ''''),',
    'evidence_reference, nullif(p_payload ->> ''externalDate'', '''')::date, acknowledged_on_value, validated_on_value, attachment_name_value, nullif(trim(p_payload ->> ''externalReference''), ''''), nullif(trim(p_payload ->> ''externalChannel''), ''''), nullif(trim(p_payload ->> ''sharepointUrl''), ''''),');

  if position('acknowledged_on_value' in definition) = 0 then
    raise exception 'Unable to refresh record_generated_work_command for structured evidence dates';
  end if;
  execute definition;
end;
$$;
