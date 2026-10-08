-- Purchase order approval. Each new order is addressed to one named approver
-- (a user who holds purchase_orders.approve), who is notified in-app and by
-- email, and who alone can approve or reject it. The creator can never
-- approve their own order. "Not approved" is only a label on the order --
-- nothing is blocked by it.
--
-- approver_email is a snapshot taken when the order is created, so the audit
-- log shows who it was sent to even if that user's address changes or the
-- account is later removed.

alter table purchase_orders
  add column approver_id             uuid references profiles(id),
  add column approver_email          text,
  add column approval_status         text check (approval_status in ('pending', 'approved', 'rejected')),
  add column approval_requested_at   timestamptz,
  add column approval_decided_at     timestamptz,
  add column approval_note           text,
  add column approval_email_sent_at  timestamptz;

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('low_stock', 'item_modified', 'po_status', 'defective_item', 'system', 'po_approval'));

-- ---------------------------------------------------------------------------
-- On insert: validate the chosen approver and stamp the approval fields, so
-- none of it depends on the app sending the right values.
-- ---------------------------------------------------------------------------
create function fn_prepare_po_approval() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approver_id is null then
    new.approver_email := null;
    new.approval_status := null;
    new.approval_requested_at := null;
    new.approval_decided_at := null;
    new.approval_note := null;
    return new;
  end if;

  if new.created_by is not null and new.approver_id = new.created_by then
    raise exception 'Pick someone other than yourself to approve this order.';
  end if;

  if not fn_has_permission(new.approver_id, 'purchase_orders', 'approve') then
    raise exception 'That person isn''t allowed to approve purchase orders.';
  end if;

  select email into new.approver_email from profiles where id = new.approver_id;
  new.approval_status := 'pending';
  new.approval_requested_at := now();
  new.approval_decided_at := null;
  new.approval_note := null;
  return new;
end;
$$;

create trigger prepare_po_approval
  before insert on purchase_orders
  for each row execute function fn_prepare_po_approval();

create function fn_notify_po_approval_requested() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approver_id is not null then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    values (
      new.approver_id, 'po_approval',
      'Approval needed: ' || new.po_number,
      'Purchase order ' || new.po_number || ' is waiting for your approval.',
      'purchase_orders', new.id
    );
  end if;
  return new;
end;
$$;

create trigger notify_po_approval_requested
  after insert on purchase_orders
  for each row execute function fn_notify_po_approval_requested();

-- ---------------------------------------------------------------------------
-- Approval details can only change through fn_decide_po_approval. Without
-- this, anyone allowed to edit a purchase order could mark it approved (or
-- swap the approver) with an ordinary update.
-- ---------------------------------------------------------------------------
create function fn_guard_po_approval_fields() returns trigger
language plpgsql
as $$
begin
  if (new.approver_id, new.approver_email, new.approval_status, new.approval_requested_at,
      new.approval_decided_at, new.approval_note)
     is distinct from
     (old.approver_id, old.approver_email, old.approval_status, old.approval_requested_at,
      old.approval_decided_at, old.approval_note)
     and coalesce(current_setting('app.po_approval', true), '') <> '1' then
    raise exception 'Approval details can only be changed through the approval process.';
  end if;
  return new;
end;
$$;

create trigger guard_po_approval_fields
  before update on purchase_orders
  for each row execute function fn_guard_po_approval_fields();

-- ---------------------------------------------------------------------------
-- Approve or reject. Runs as the caller (auth.uid()), so the audit log
-- records who actually decided.
-- ---------------------------------------------------------------------------
create function fn_decide_po_approval(p_po_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not fn_has_permission(auth.uid(), 'purchase_orders', 'approve') then
    raise exception 'You do not have permission to approve purchase orders.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if p_decision = 'rejected' and v_note is null then
    raise exception 'Say why you are rejecting this order.';
  end if;

  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order not found.';
  end if;

  if v_po.approval_status is distinct from 'pending' then
    raise exception 'This order is not waiting for approval.';
  end if;

  if v_po.approver_id is distinct from auth.uid() then
    raise exception 'Only the person this order was sent to can approve it.';
  end if;

  if v_po.created_by is not null and v_po.created_by = auth.uid() then
    raise exception 'You created this order, so someone else has to approve it.';
  end if;

  perform set_config('app.po_approval', '1', true);
  update purchase_orders
  set approval_status = p_decision,
      approval_decided_at = now(),
      approval_note = v_note
  where id = p_po_id;

  if v_po.created_by is not null then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    values (
      v_po.created_by, 'po_approval',
      v_po.po_number || ' was ' || p_decision,
      coalesce(v_note, 'Your purchase order ' || v_po.po_number || ' was ' || p_decision || '.'),
      'purchase_orders', p_po_id
    );
  end if;
end;
$$;

grant execute on function fn_decide_po_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Deleting: an approved order needs its PO number typed to confirm, on top
-- of the existing rules (nothing received, no expenses, no defect reports).
-- Replaces the one-argument version from 20261008100000.
-- ---------------------------------------------------------------------------
drop function fn_delete_purchase_order(uuid);

create function fn_delete_purchase_order(p_po_id uuid, p_confirm text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders%rowtype;
begin
  if not fn_has_permission(auth.uid(), 'purchase_orders', 'delete') then
    raise exception 'You do not have permission to delete purchase orders.';
  end if;

  select * into v_po from purchase_orders where id = p_po_id;
  if not found then
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

  if v_po.approval_status = 'approved' and trim(coalesce(p_confirm, '')) <> v_po.po_number then
    raise exception 'This order has been approved. Type its PO number to confirm deleting it.';
  end if;

  delete from calendar_events where related_po_id = p_po_id;
  delete from purchase_orders where id = p_po_id;
end;
$$;

grant execute on function fn_delete_purchase_order(uuid, text) to authenticated;
