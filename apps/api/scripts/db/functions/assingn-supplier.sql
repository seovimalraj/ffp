create or replace function assign_supplier_to_order(
    p_order_id uuid,
    p_supplier_id uuid,
    p_assigned_by uuid
)
returns table (
    assignment_id uuid,
    order_id uuid,
    assigned_to uuid,
    current_status text
)
language plpgsql
as $$
declare
    v_assignment_id uuid;
    v_order_record orders%rowtype;
begin

    -- lock the order row
    select *
    into v_order_record
    from orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'Order not found';
    end if;

    -- check supplier validity
    if not exists (
        select 1
        from organizations
        where id = p_supplier_id
        and organization_type = 'supplier'
    ) then
        raise exception 'Invalid supplier';
    end if;

    -- optional: prevent duplicate active assignment
    if exists (
        select 1
        from supplier_assignments sa
        where sa.order_id = p_order_id
        and sa.current_status = 'active'
    ) then
        raise exception 'Order already has an active supplier';
    end if;

    -- update order
    update orders
    set assigned_supplier = p_supplier_id
    where id = p_order_id;

    -- insert assignment history
    insert into supplier_assignments (
        order_id,
        assigned_to,
        assigned_by,
        current_status
    )
    values (
        p_order_id,
        p_supplier_id,
        p_assigned_by,
        'active'
    )
    returning id into v_assignment_id;

    return query
    select
        sa.id,
        sa.order_id,
        sa.assigned_to,
        sa.current_status
    from supplier_assignments sa
    where sa.id = v_assignment_id;

end;
$$;