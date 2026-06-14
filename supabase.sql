-- ═══════════════════════════════════════════════════════════════════════════
-- EcoLogistics — Script SQL Único
-- Ejecutar completo en: Supabase Dashboard → SQL Editor
-- Orden de ejecución: de arriba hacia abajo, una sola vez.
-- Todos los bloques son idempotentes (IF NOT EXISTS / OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1: PERFILES DE USUARIO
-- Extiende auth.users con rol y datos de visualización.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('admin', 'trabajador')) default 'trabajador',
  nombre     text,
  cargo      text,
  avatar     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"    on public.profiles;
drop policy if exists "profiles_select_admin"  on public.profiles;
drop policy if exists "profiles_update_own"    on public.profiles;
drop policy if exists "profiles_update_admin"  on public.profiles;
drop policy if exists "profiles_insert_system" on public.profiles;

create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin'));

create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and rol = (select rol from public.profiles where id = auth.uid()));

create policy "profiles_update_admin" on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin'));

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, rol, nombre, cargo, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'rol',    'trabajador'),
    coalesce(new.raw_user_meta_data->>'nombre',  new.email),
    coalesce(new.raw_user_meta_data->>'cargo',   ''),
    coalesce(new.raw_user_meta_data->>'avatar',  upper(left(new.email, 2)))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2: CATEGORÍAS DINÁMICAS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public."Categoria" (
  "idCategoria" serial primary key,
  nombre        text not null,
  icono         text,
  created_at    timestamptz default now()
);

create index if not exists categoria_nombre_idx on public."Categoria"(nombre);

-- Datos iniciales (solo si la tabla está vacía)
insert into public."Categoria" ("idCategoria", nombre, icono)
select * from (values
  (1, 'Electrical', 'bolt'),
  (2, 'Solar',      'sun'),
  (3, 'Storage',    'battery'),
  (4, 'Panels',     'panel'),
  (5, 'Cables',     'plug'),
  (6, 'Tools',      'tool')
) as t("idCategoria", nombre, icono)
where not exists (select 1 from public."Categoria" limit 1);

alter table public."Categoria" enable row level security;

drop policy if exists "categoria_select_auth"   on public."Categoria";
drop policy if exists "categoria_insert_admin"  on public."Categoria";
drop policy if exists "categoria_update_admin"  on public."Categoria";
drop policy if exists "categoria_delete_admin"  on public."Categoria";

create policy "categoria_select_auth" on public."Categoria" for select
  using (auth.role() = 'authenticated');

create policy "categoria_insert_admin" on public."Categoria" for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "categoria_update_admin" on public."Categoria" for update
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "categoria_delete_admin" on public."Categoria" for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3: TABLA PRODUCTO
-- Agrega columnas faltantes si no existen.
-- IMPORTANTE: Si tu columna de precio NO se llama 'valor', ejecuta esto antes:
--   alter table public."Producto" rename column <nombre_actual> to valor;
-- ─────────────────────────────────────────────────────────────────────────────

-- Columnas adicionales
alter table public."Producto"
  add column if not exists valor        numeric(12,2) default 0,
  add column if not exists unidad       text          default 'unidades',
  add column if not exists descripcion  text,
  add column if not exists ubicacion    text,
  add column if not exists qr_data_url  text,
  add column if not exists created_at   timestamptz   default now(),
  add column if not exists updated_at   timestamptz   default now();

-- Constraint UNIQUE en SKU (resolver duplicados antes si existen)
alter table public."Producto"
  drop constraint if exists producto_sku_unique;
alter table public."Producto"
  add constraint producto_sku_unique unique (sku);

-- FK hacia Categoria
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'producto_idcategoria_fk'
  ) then
    alter table public."Producto"
      add constraint producto_idcategoria_fk
      foreign key ("idCategoria") references public."Categoria"("idCategoria")
      on update cascade on delete restrict;
  end if;
end;
$$;

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_producto_updated_at on public."Producto";
create trigger set_producto_updated_at
  before update on public."Producto"
  for each row execute procedure public.set_updated_at();

-- RLS Producto
alter table public."Producto" enable row level security;

drop policy if exists "producto_select_auth"   on public."Producto";
drop policy if exists "producto_insert_admin"  on public."Producto";
drop policy if exists "producto_update_admin"  on public."Producto";
drop policy if exists "producto_delete_admin"  on public."Producto";

create policy "producto_select_auth" on public."Producto" for select
  using (auth.role() = 'authenticated');

create policy "producto_insert_admin" on public."Producto" for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "producto_update_admin" on public."Producto" for update
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "producto_delete_admin" on public."Producto" for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

alter table public."Producto" enable row level security;

drop policy if exists "producto_select_auth"   on public."Producto";
drop policy if exists "producto_insert_admin"  on public."Producto";
drop policy if exists "producto_update_admin"  on public."Producto";
drop policy if exists "producto_delete_admin"  on public."Producto";

create policy "producto_select_auth" on public."Producto" for select
  using (auth.role() = 'authenticated');

create policy "producto_insert_admin" on public."Producto" for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "producto_update_admin" on public."Producto" for update
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));

create policy "producto_delete_admin" on public."Producto" for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin'));




-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4: TABLAS SALIDA y DETALLE SALIDA
-- ─────────────────────────────────────────────────────────────────────────────

alter table public."Salida"        enable row level security;
alter table public."DetalleSalida" enable row level security;

drop policy if exists "salida_select_auth"  on public."Salida";
drop policy if exists "salida_insert_auth"  on public."Salida";
drop policy if exists "detalle_select_auth" on public."DetalleSalida";
drop policy if exists "detalle_insert_auth" on public."DetalleSalida";

create policy "salida_select_auth" on public."Salida" for select
  using (auth.role() = 'authenticated');
create policy "salida_insert_auth" on public."Salida" for insert
  with check (auth.role() = 'authenticated');

create policy "detalle_select_auth" on public."DetalleSalida" for select
  using (auth.role() = 'authenticated');
create policy "detalle_insert_auth" on public."DetalleSalida" for insert
  with check (auth.role() = 'authenticated');


alter table public."Salida"        enable row level security;
alter table public."DetalleSalida" enable row level security;

drop policy if exists "salida_select_auth"  on public."Salida";
drop policy if exists "salida_insert_auth"  on public."Salida";
drop policy if exists "detalle_select_auth" on public."DetalleSalida";
drop policy if exists "detalle_insert_auth" on public."DetalleSalida";

create policy "salida_select_auth" on public."Salida" for select
  using (auth.role() = 'authenticated');
create policy "salida_insert_auth" on public."Salida" for insert
  with check (auth.role() = 'authenticated');

create policy "detalle_select_auth" on public."DetalleSalida" for select
  using (auth.role() = 'authenticated');
create policy "detalle_insert_auth" on public."DetalleSalida" for insert
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5: TABLA ACTIVIDAD_LOG (auditoría + historial)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.actividad_log (
  id           bigserial primary key,
  tipo         text not null,
  descripcion  text not null,
  usuario      text,
  user_id      uuid references auth.users(id) on delete set null,
  reference_id bigint,          -- idProducto u otro ID de referencia
  created_at   timestamptz default now()
);

create index if not exists actividad_log_created_at_idx  on public.actividad_log(created_at desc);
create index if not exists actividad_log_reference_idx   on public.actividad_log(reference_id);

alter table public.actividad_log enable row level security;

drop policy if exists "actividad_select_auth"   on public.actividad_log;
drop policy if exists "actividad_insert_system" on public.actividad_log;

create policy "actividad_select_auth" on public.actividad_log for select
  using (auth.role() = 'authenticated');

-- Solo triggers/RPCs (security definer) pueden insertar
create policy "actividad_insert_system" on public.actividad_log for insert
  with check (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6: FUNCIÓN HELPER log_actividad
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.log_actividad(
  p_tipo         text,
  p_descripcion  text,
  p_user_id      uuid    default null,
  p_reference_id bigint  default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
begin
  if p_user_id is not null then
    select nombre into v_nombre from public.profiles where id = p_user_id;
  end if;
  insert into public.actividad_log (tipo, descripcion, usuario, user_id, reference_id)
  values (p_tipo, p_descripcion, coalesce(v_nombre, 'Sistema'), p_user_id, p_reference_id);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 7: TRIGGERS DE AUDITORÍA EN PRODUCTO
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.trigger_producto_creado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text;
begin
  select nombre into v_cat from public."Categoria" where "idCategoria" = new."idCategoria";
  perform public.log_actividad(
    'producto_creado',
    'Producto creado: ' || new."nombreProducto" || ' (SKU: ' || coalesce(new.sku,'—') || ') — Categoría: ' || coalesce(v_cat,'—'),
    auth.uid(), new."idProducto"
  );
  return new;
end;
$$;

drop trigger if exists on_producto_created on public."Producto";
create trigger on_producto_created
  after insert on public."Producto"
  for each row execute procedure public.trigger_producto_creado();

create or replace function public.trigger_producto_actualizado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old."stockActual" is distinct from new."stockActual" then
    perform public.log_actividad('producto_editado',
      'Stock: ' || new."nombreProducto" || ' ' || coalesce(old."stockActual"::text,'?') || '→' || new."stockActual"::text || ' uds.',
      auth.uid(), new."idProducto");
  end if;
  if old."stockMinimo" is distinct from new."stockMinimo" then
    perform public.log_actividad('stock_minimo',
      'Stock mínimo: ' || new."nombreProducto" || ' → ' || new."stockMinimo"::text || ' uds.',
      auth.uid(), new."idProducto");
  end if;
  if old.valor is distinct from new.valor then
    perform public.log_actividad('precio_actualizado',
      'Precio: ' || new."nombreProducto" || ' → $' || new.valor::text,
      auth.uid(), new."idProducto");
  end if;
  if old."nombreProducto" is distinct from new."nombreProducto"
     or old.sku             is distinct from new.sku
     or old."idCategoria"   is distinct from new."idCategoria" then
    perform public.log_actividad('producto_editado',
      'Datos editados: ' || new."nombreProducto",
      auth.uid(), new."idProducto");
  end if;
  return new;
end;
$$;

drop trigger if exists on_producto_updated on public."Producto";
create trigger on_producto_updated
  after update on public."Producto"
  for each row execute procedure public.trigger_producto_actualizado();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 8: TRIGGER DE AUDITORÍA EN SALIDA
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.trigger_salida_creada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_actividad(
    'salida_registrada',
    'Salida para: ' || coalesce(new.proyecto,'—') || ' — $' || coalesce(new."montoTotalEstimado"::text,'0'),
    auth.uid(), null
  );
  return new;
end;
$$;

drop trigger if exists on_salida_created on public."Salida";
create trigger on_salida_created
  after insert on public."Salida"
  for each row execute procedure public.trigger_salida_creada();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 9: RPC ATÓMICA registrar_salida
-- Una sola transacción: INSERT Salida + INSERT DetalleSalida + UPDATE stock
-- Protegida con FOR UPDATE para evitar condiciones de carrera.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.registrar_salida(
  p_proyecto   text,
  p_notas      text,
  p_monto      numeric,
  p_id_persona uuid,    -- antes era "int" — cámbialo a uuid
  p_detalles   jsonb
)
returns jsonb language plpgsql security definer as $$
declare
  v_id_salida int;
  v_det       jsonb;
  v_stock     int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  insert into public."Salida" (proyecto, notas, "montoTotalEstimado", "idPersona")
  values (p_proyecto, p_notas, p_monto, p_id_persona)
  returning "idSalida" into v_id_salida;

  for v_det in select * from jsonb_array_elements(p_detalles) loop
    select "stockActual" into v_stock
    from public."Producto"
    where "idProducto" = (v_det->>'idProducto')::int
    for update;

    if v_stock is null then
      raise exception 'Producto % no encontrado', v_det->>'idProducto';
    end if;
    if v_stock < (v_det->>'cantidad')::int then
      raise exception 'Stock insuficiente para producto %', v_det->>'idProducto';
    end if;

    insert into public."DetalleSalida" ("idSalida","idProducto",cantidad)
    values (v_id_salida,(v_det->>'idProducto')::int,(v_det->>'cantidad')::int);

    update public."Producto"
    set "stockActual" = "stockActual" - (v_det->>'cantidad')::int
    where "idProducto" = (v_det->>'idProducto')::int;
  end loop;

  return jsonb_build_object('idSalida', v_id_salida, 'ok', true);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 10: REALTIME — activar publicación en tablas clave
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public."Producto";
alter publication supabase_realtime add table public."Salida";
alter publication supabase_realtime add table public."DetalleSalida";
alter publication supabase_realtime add table public.actividad_log;
alter publication supabase_realtime add table public."Categoria";


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 11: INSTRUCCIONES MANUALES POST-EJECUCIÓN
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. CREAR USUARIO ADMIN:
--    Supabase Dashboard → Authentication → Users → "Invite user"
--    Ingresa el correo del administrador. Cuando confirme su cuenta:
--
--    update public.profiles
--    set rol = 'admin', nombre = 'Nombre Admin', cargo = 'Gerente de Almacén', avatar = 'AU'
--    where id = '<UUID del usuario recién creado>';
--
-- 2. VERIFICAR NOMBRE DE COLUMNA DE PRECIO:
--    select column_name from information_schema.columns
--    where table_name = 'Producto' and column_name in ('valor','precio_unitario','price');
--
--    Si NO aparece 'valor', renombrar:
--    alter table public."Producto" rename column <nombre_actual> to valor;
--
-- 3. VERIFICAR QUE NO HAY SKUs DUPLICADOS ANTES DE DESPLEGAR:
--    select sku, count(*) from public."Producto" group by sku having count(*) > 1;
--    Resolver manualmente antes de que el constraint UNIQUE falle.
--
-- 4. REALTIME — si la línea "alter publication" falla porque la tabla ya está
--    incluida, ignorar el error. No afecta el funcionamiento.
