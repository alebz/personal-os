-- ANTI-PENDEJOS: "Clip" es un beneficiario (la comisión que Clip te cobra). Se siembra en la libreta para que
-- los costos de comisión (manual desde Contenedores + import de settlements) tengan su proveedor en el directorio.
insert into publico_proveedores (nombre)
values ('Clip')
on conflict (lower(nombre)) do nothing;
