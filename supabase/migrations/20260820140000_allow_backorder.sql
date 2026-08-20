-- "Allow backorder" lets specific items (made-to-order goods, e.g. custom
-- taxi decals) keep selling past zero stock without the usual oversell
-- guard rejecting the sale. The ledger still logs the real sale -- POS
-- needs that recorded like any other purchase -- but the *displayed*
-- stock never goes negative (floored at zero below), and the existing
-- reorder_threshold mechanism is still what tells staff to restock/produce
-- more. Everything else about these items is unchanged.

alter table items add column allow_backorder boolean not null default false;

-- Floor at zero. An item sold past its last unit (only possible when
-- allow_backorder is true -- see fn_record_pos_sale and recordStockMovement
-- below) still reads "0 in stock" everywhere this view is used (Items
-- list, Dashboard, reorder suggestions, the external /api/v1/items catalog
-- POS reads from) instead of a negative number. The underlying
-- stock_movements ledger is untouched -- it keeps the true, complete
-- history; only this derived read is floored.
create or replace view item_stock_levels as
select i.id as item_id, greatest(coalesce(sum(sm.quantity_delta), 0), 0)::integer as current_stock
from items i
left join stock_movements sm on sm.item_id = i.id
group by i.id;

-- Same body as the previous version (20260819120000_bundle_constituent_overrides.sql),
-- with each of the three oversell checks (plain item, bundle default
-- recipe, bundle override) now skipped when the relevant item/constituent
-- has allow_backorder = true.
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
  v_constituent_allow_backorder boolean;
  v_movement_id uuid;
  v_override jsonb;
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
      v_override := v_line -> 'constituents';

      if v_override is not null then
        for v_constituent in
          select (elem ->> 'itemId')::uuid as item_id, (elem ->> 'quantity')::integer as quantity
          from jsonb_array_elements(v_override) as elem
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(quantity_delta), 0) into v_current_stock
          from stock_movements where item_id = v_constituent.item_id;

          select allow_backorder into v_constituent_allow_backorder
          from items where id = v_constituent.item_id;

          if v_current_stock - v_constituent_qty < 0 and not coalesce(v_constituent_allow_backorder, false) then
            raise exception 'Only % in stock -- can''t sell % of bundle %.',
              v_current_stock, v_line_qty, v_item.sku;
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, -v_constituent_qty, 'sale', 'pos_sale', p_reference, p_note)
          returning id into v_movement_id;

          movement_id := v_movement_id;
          return next;
        end loop;
      else
        for v_constituent in
          select bi.item_id, bi.quantity, i.sku, i.allow_backorder
          from bundle_items bi
          join items i on i.id = bi.item_id
          where bi.bundle_id = v_item.id
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(quantity_delta), 0) into v_current_stock
          from stock_movements where item_id = v_constituent.item_id;

          if v_current_stock - v_constituent_qty < 0 and not v_constituent.allow_backorder then
            raise exception 'Only % of % in stock -- can''t sell % of bundle %.',
              v_current_stock, v_constituent.sku, v_line_qty, v_item.sku;
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, -v_constituent_qty, 'sale', 'pos_sale', p_reference, p_note)
          returning id into v_movement_id;

          movement_id := v_movement_id;
          return next;
        end loop;
      end if;
    else
      select coalesce(sum(quantity_delta), 0) into v_current_stock
      from stock_movements where item_id = v_item.id;

      if v_current_stock - v_line_qty < 0 and not v_item.allow_backorder then
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
