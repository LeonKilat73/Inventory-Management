-- Stock ledger integrity. The insert policy on stock_movements only checked
-- that the caller holds stock_movements.create, so anyone with that
-- permission (staff included) could write a row straight through the REST
-- API with any type, any sign, and no author -- e.g. +999 labelled
-- "po_receipt", or a positive "sale". The app's own forms never do this, but
-- the rules lived only in app code.
--
-- Now enforced in the database:
--   * users may insert directly only the four manual movement types the app
--     uses (receiving, defect handling and POS sales go through
--     security-definer functions, which bypass this policy);
--   * a movement's sign must match its type, and can't be zero;
--   * created_by is always the signed-in user, never client-supplied.

create function fn_stock_movement_integrity() returns trigger
language plpgsql
as $$
begin
  if new.quantity_delta = 0 then
    raise exception 'A stock movement can''t be zero.';
  end if;

  if new.movement_type in ('sale', 'replacement_out', 'defective_removal') and new.quantity_delta > 0 then
    raise exception 'A % movement must reduce stock.', new.movement_type;
  end if;

  if new.movement_type in ('po_receipt', 'replacement_in', 'defective_return_to_stock') and new.quantity_delta < 0 then
    raise exception 'A % movement must add stock.', new.movement_type;
  end if;

  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger stock_movement_integrity
  before insert on stock_movements
  for each row execute function fn_stock_movement_integrity();

drop policy stock_movements_insert on stock_movements;
create policy stock_movements_insert on stock_movements
  for insert with check (
    fn_has_permission(auth.uid(), 'stock_movements', 'create')
    and movement_type in ('sale', 'replacement_out', 'replacement_in', 'manual_adjustment')
  );
