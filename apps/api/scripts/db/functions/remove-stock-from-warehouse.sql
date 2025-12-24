create or replace function remove_stock_from_warehouse(
  p_org_id uuid,
  p_material_id uuid,
  p_warehouse_id uuid,
  p_quantity int
)
returns json
language plpgsql
as $$
declare
  _material record;
  _warehouse record;
begin
  -- Lock material row to avoid race conditions
  select * into _material
  from supplier_materials
  where supplier_id = p_org_id
    and material_id = p_material_id
    and warehouse_id = p_warehouse_id
  for update;

  if not found then
    raise exception 'Stock entry not found';
  end if;

  if _material.stock_quantity < p_quantity then
    raise exception 'Insufficient stock quantity';
  end if;

  -- Lock warehouse row
  select * into _warehouse
  from warehouses
  where id = p_warehouse_id
  for update;

  if not found then
    raise exception 'Warehouse not found';
  end if;

  if _warehouse.used_capacity < p_quantity then
    raise exception 'Invalid warehouse used capacity';
  end if;

  -- Atomic stock update
  update supplier_materials
  set stock_quantity = stock_quantity - p_quantity
  where supplier_id = p_org_id
    and material_id = p_material_id
    and warehouse_id = p_warehouse_id;

  -- Atomic warehouse capacity update
  update warehouses
  set used_capacity = used_capacity - p_quantity
  where id = p_warehouse_id;

  return json_build_object('success', true);
end;
$$;
