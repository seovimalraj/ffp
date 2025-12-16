create or replace function add_stock_to_warehouse(
    p_supplier_material_id uuid,
    p_warehouse_id uuid,
    p_org_id uuid,
    p_quantity int
  ) returns json language plpgsql as $$
declare _material record;
_warehouse record;
begin -- lock rows (prevent race conditions)
select * into _material
from supplier_materials
where id = p_supplier_material_id for
update;
if not found then raise exception 'Supplier material not found';
end if;
if _material.current_stock + p_quantity > _material.max_stock then raise exception 'Exceeds max stock';
end if;
select * into _warehouse
from warehouses
where id = p_warehouse_id
  and organization_id = p_org_id for
update;
if not found then raise exception 'Warehouse not found';
end if;
if _warehouse.used_capacity + p_quantity > _warehouse.total_capacity then raise exception 'Not enough warehouse capacity';
end if;
-- perform updates atomically
update warehouses
set used_capacity = used_capacity + p_quantity
where id = p_warehouse_id;
update supplier_materials
set current_stock = current_stock + p_quantity
where id = p_supplier_material_id;
return json_build_object('success', true);
end;
$$;