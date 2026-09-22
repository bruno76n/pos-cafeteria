ALTER TABLE "productos" ADD COLUMN "tamanos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Si existe un grupo global "Tamaño", sus opciones pasan a ser tamaños propios de cada producto
-- que lo usa (precio = precio base + precio extra; la opción por defecto va primero) y el grupo
-- se elimina. Se sube rev y actualizado_en para que las tablets reciban el cambio en el pull.
UPDATE "productos" AS p SET
  "tamanos" = (
    SELECT jsonb_agg(
      jsonb_build_object('id', o->>'id', 'nombre', o->>'nombre', 'precio', p."precio" + (o->>'precioExtra')::int)
      ORDER BY (o->>'porDefecto')::boolean DESC, n
    )
    FROM jsonb_array_elements(g."opciones") WITH ORDINALITY AS t(o, n)
  ),
  "grupos_ids" = (
    SELECT coalesce(jsonb_agg(x ORDER BY n), '[]'::jsonb)
    FROM jsonb_array_elements(p."grupos_ids") WITH ORDINALITY AS t(x, n)
    WHERE x <> to_jsonb(g."id")
  ),
  "actualizado_en" = now(),
  "rev" = nextval('rev_global')
FROM "grupos_modificadores" AS g
WHERE translate(lower(g."nombre"), 'ñ', 'n') IN ('tamano', 'tamanos')
  AND NOT g."borrado"
  AND jsonb_array_length(g."opciones") > 0
  AND p."grupos_ids" ? g."id"
  AND jsonb_array_length(p."tamanos") = 0;
--> statement-breakpoint
UPDATE "grupos_modificadores" SET "borrado" = true, "actualizado_en" = now(), "rev" = nextval('rev_global')
WHERE translate(lower("nombre"), 'ñ', 'n') IN ('tamano', 'tamanos') AND NOT "borrado";
