-- Backs the new POST /api/v1/sales endpoint: records a whole cart (plain
-- items and/or bundles) as one atomic set of stock_movements rows, so a
-- POS checkout can't ever half-apply -- if any line would oversell, the
-- entire call raises and nothing is inserted.
--
-- Not gated by fn_has_permission(auth.uid(), ...) like the internal
-- receive_purchase_order_line()/report_defective_item() functions -- this is
-- only ever called via the API route's service-role client (no end-user JWT,
-- auth.uid() would just be null), and authorization already happened at the
-- route level via authenticateApiKey(request, { requireWrite: true }). Same
-- model as the existing recordStockMovement() JS helper used by
-- POST /api/v1/stock-movements: the caller enforces access, this enforces
-- the data invariant (never go negative).
create or replace function fn_record_pos_sale(p_lines jsonb, p_reference uuid default null, p_note text default null)
returns table(movement_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_line_qty integer;
  v_item items%rowtype;
  v_constituent record;
  v_constituent_qty integer;
  v_current_stock integer;
  v_movement_id uuid;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart must have at least one line.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_qty := (v_line ->> 'quantity')::integer;
    if v_line_qty is null or v_line_qty <= 0 then
      raise exception 'Each line quantity must be positive.';
    end if;

    select * into v_item from items where id = (v_line ->> 'itemId')::uuid;
    if not found then
      raise exception 'Item % not found.', v_line ->> 'itemId';
    end if;

    if v_item.is_bundle then
      for v_constituent in
        select bi.item_id, bi.quantity, i.sku
        from bundle_items bi
        join items i on i.id = bi.item_id
        where bi.bundle_id = v_item.id
      loop
        v_constituent_qty := v_constituent.quantity * v_line_qty;

        select coalesce(sum(quantity_delta), 0) into v_current_stock
        from stock_movements where item_id = v_constituent.item_id;

        if v_current_stock - v_constituent_qty < 0 then
          raise exception 'Only % of % in stock -- can''t sell % of bundle %.',
            v_current_stock, v_constituent.sku, v_line_qty, v_item.sku;
        end if;

        insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
        values (v_constituent.item_id, -v_constituent_qty, 'sale', 'pos_sale', p_reference, p_note)
        returning id into v_movement_id;

        movement_id := v_movement_id;
        return next;
      end loop;
    else
      select coalesce(sum(quantity_delta), 0) into v_current_stock
      from stock_movements where item_id = v_item.id;

      if v_current_stock - v_line_qty < 0 then
        raise exception 'Only % of % in stock -- can''t sell %.', v_current_stock, v_item.sku, v_line_qty;
      end if;

      insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
      values (v_item.id, -v_line_qty, 'sale', 'pos_sale', p_reference, p_note)
      returning id into v_movement_id;

      movement_id := v_movement_id;
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function fn_record_pos_sale(jsonb, uuid, text) to service_role;
