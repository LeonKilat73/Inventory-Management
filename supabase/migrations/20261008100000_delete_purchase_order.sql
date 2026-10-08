-- Deleting a purchase order. Done in one security-definer function (same
-- pattern as receive_purchase_order_line) so the checks and the several
-- deletes are all-or-nothing, and so the caller only needs
-- purchase_orders.delete -- not also calendar.delete just to clear the
-- delivery reminder the order created.
--
-- Refused once anything was received against the order: stock_movements
-- (append-only, keyed to the order's lines) and expenses depend on it.
-- Cancel it instead -- that keeps the history intact.

create function fn_delete_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fn_has_permission(auth.uid(), 'purchase_orders', 'delete') then
    raise exception 'You do not have permission to delete purchase orders.';
  end if;

  if not exists (select 1 from purchase_orders where id = p_po_id) then
    raise exception 'Purchase order not found.';
  end if;

  if exists (
    select 1 from purchase_order_lines
    where purchase_order_id = p_po_id and quantity_received > 0
  ) then
    raise exception 'This order has goods received against it, so it can''t be deleted -- stock and expenses depend on it. Cancel it instead to stop waiting for the rest.';
  end if;

  if exists (select 1 from expenses where purchase_order_id = p_po_id) then
    raise exception 'This order has expenses recorded against it, so it can''t be deleted. Cancel it instead.';
  end if;

  if exists (select 1 from defective_items where related_po_id = p_po_id) then
    raise exception 'A defective-item report refers to this order, so it can''t be deleted. Cancel it instead.';
  end if;

  -- The delivery reminder created when the order was submitted.
  delete from calendar_events where related_po_id = p_po_id;

  -- purchase_order_lines cascade with the order.
  delete from purchase_orders where id = p_po_id;
end;
$$;

grant execute on function fn_delete_purchase_order(uuid) to authenticated;
