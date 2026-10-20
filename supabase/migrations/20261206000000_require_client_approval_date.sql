-- Client approval is an external outcome and must retain the date reported by the client.

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

  if definition is null then
    raise exception 'record_generated_work_command is not available to refresh';
  end if;
  if position('Record the client approval date before completing client approval.' in definition) > 0 then
    return;
  end if;

  definition := replace(definition,
    '    if step_code_value = ''payment-confirmation'' and status_value = ''complete'' and work.payment_amount is null then raise exception using errcode = ''22023'', message = ''Record the payment amount before confirming payment.''; end if;',
    '    if step_code_value = ''payment-confirmation'' and status_value = ''complete'' and work.payment_amount is null then raise exception using errcode = ''22023'', message = ''Record the payment amount before confirming payment.''; end if;
    if step_code_value = ''client-approval'' and status_value = ''complete'' and nullif(trim(p_payload ->> ''externalDate''), '''') is null then raise exception using errcode = ''22023'', message = ''Record the client approval date before completing client approval.''; end if;');

  if position('Record the client approval date before completing client approval.' in definition) = 0 then
    raise exception 'Unable to refresh record_generated_work_command for client approval date control';
  end if;
  execute definition;
end;
$$;
