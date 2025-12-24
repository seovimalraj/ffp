  create or replace function create_stock_for_warehouse(
    p_org_id uuid,
    p_material_id uuid,
    p_warehouse_id uuid,
    p_quantity int,
    p_unit text,
    p_price numeric,
    p_currency text,
    p_max_stock int
  )
  returns json
  language plpgsql
  as $$
  declare
    _warehouse record;
  begin
    -- Lock the warehouse row to avoid race conditions
    select * into _warehouse
    from warehouses
    where id = p_warehouse_id and organization_id = p_org_id
    for update;

    if not found then
      raise exception 'Warehouse not found';
    end if;

    if _warehouse.used_capacity + p_quantity > _warehouse.total_capacity then
      raise exception 'Not enough warehouse capacity';
    end if;

    -- UPSERT supplier material atomically
    insert into supplier_materials (
      supplier_id,
      material_id,
      warehouse_id,
      current_stock,
      stock_unit,
      supplier_price,
      currency,
      max_stock
    )
    values (
      p_org_id,
      p_material_id,
      p_warehouse_id,
      p_quantity,
      p_unit::unit_type,
      p_price,
      p_currency::currency_type,
      p_max_stock
    )
    on conflict (supplier_id, material_id, warehouse_id)
    do update set
      current_stock = excluded.current_stock,
      stock_unit = excluded.stock_unit,
      supplier_price = excluded.supplier_price,
      currency = excluded.currency,
      max_stock = excluded.max_stock;

    -- Update warehouse capacity atomically
    update warehouses
    set used_capacity = used_capacity + p_quantity
    where id = p_warehouse_id;

    return json_build_object('success', true);
  end;
  $$;
