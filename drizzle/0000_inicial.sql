CREATE SEQUENCE "public"."rev_global" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"color" text NOT NULL,
	"orden" integer NOT NULL,
	"activa" boolean NOT NULL,
	"borrado" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" text PRIMARY KEY NOT NULL,
	"datos" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuentas" (
	"id" text PRIMARY KEY NOT NULL,
	"correo" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "devoluciones" (
	"id" text PRIMARY KEY NOT NULL,
	"venta_id" text NOT NULL,
	"folio_venta" text NOT NULL,
	"turno_id" text,
	"dispositivo_id" text NOT NULL,
	"lineas" jsonb NOT NULL,
	"monto" integer NOT NULL,
	"metodo" text NOT NULL,
	"motivo" text NOT NULL,
	"usuario" jsonb NOT NULL,
	"autorizado_por" jsonb,
	"fecha" timestamp with time zone NOT NULL,
	"dia" date NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositivos" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"prefijo" text,
	"ultimo_folio" integer NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupos_modificadores" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"obligatorio" boolean NOT NULL,
	"min" integer NOT NULL,
	"max" integer NOT NULL,
	"orden" integer NOT NULL,
	"opciones" jsonb NOT NULL,
	"borrado" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" text PRIMARY KEY NOT NULL,
	"turno_id" text NOT NULL,
	"dispositivo_id" text NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text,
	"concepto" text NOT NULL,
	"monto" integer NOT NULL,
	"usuario" jsonb NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"dia" date NOT NULL,
	"anulado" boolean NOT NULL,
	"anulado_por" jsonb,
	"anulado_en" timestamp with time zone,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operaciones_aplicadas" (
	"id" text PRIMARY KEY NOT NULL,
	"aplicada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL,
	"categoria_id" text NOT NULL,
	"precio" integer NOT NULL,
	"imagen" text,
	"disponible" boolean NOT NULL,
	"orden" integer NOT NULL,
	"grupos_ids" jsonb NOT NULL,
	"borrado" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" text PRIMARY KEY NOT NULL,
	"dispositivo_id" text NOT NULL,
	"dispositivo_nombre" text NOT NULL,
	"estado" text NOT NULL,
	"abierto_por" jsonb NOT NULL,
	"abierto_en" timestamp with time zone NOT NULL,
	"dia" date NOT NULL,
	"fondo_inicial" integer NOT NULL,
	"cerrado_por" jsonb,
	"cerrado_en" timestamp with time zone,
	"efectivo_contado" integer,
	"conteo" jsonb,
	"resumen" jsonb,
	"nota" text,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"rol" text NOT NULL,
	"pin_hash" text NOT NULL,
	"pin_sal" text NOT NULL,
	"activo" boolean NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" text PRIMARY KEY NOT NULL,
	"folio" text NOT NULL,
	"folio_numero" integer NOT NULL,
	"dispositivo_id" text NOT NULL,
	"dispositivo_nombre" text NOT NULL,
	"turno_id" text NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"dia" date NOT NULL,
	"cajero" jsonb NOT NULL,
	"cliente" text,
	"lineas" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"descuento" jsonb,
	"iva" jsonb NOT NULL,
	"total" integer NOT NULL,
	"pagos" jsonb NOT NULL,
	"cambio" integer NOT NULL,
	"estado" text NOT NULL,
	"devuelto" integer NOT NULL,
	"cancelacion" jsonb,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE INDEX "categorias_rev_index" ON "categorias" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "config_rev_index" ON "config" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "devoluciones_fecha_index" ON "devoluciones" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "devoluciones_dia_index" ON "devoluciones" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "devoluciones_venta_id_index" ON "devoluciones" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "devoluciones_rev_index" ON "devoluciones" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "dispositivos_rev_index" ON "dispositivos" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "grupos_modificadores_rev_index" ON "grupos_modificadores" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "movimientos_turno_id_index" ON "movimientos" USING btree ("turno_id");--> statement-breakpoint
CREATE INDEX "movimientos_dia_index" ON "movimientos" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "movimientos_rev_index" ON "movimientos" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "productos_rev_index" ON "productos" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "turnos_dispositivo_id_estado_index" ON "turnos" USING btree ("dispositivo_id","estado");--> statement-breakpoint
CREATE INDEX "turnos_dia_index" ON "turnos" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "turnos_rev_index" ON "turnos" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "usuarios_rev_index" ON "usuarios" USING btree ("rev");--> statement-breakpoint
CREATE UNIQUE INDEX "ventas_folio_index" ON "ventas" USING btree ("folio");--> statement-breakpoint
CREATE INDEX "ventas_fecha_index" ON "ventas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "ventas_dia_index" ON "ventas" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "ventas_turno_id_index" ON "ventas" USING btree ("turno_id");--> statement-breakpoint
CREATE INDEX "ventas_rev_index" ON "ventas" USING btree ("rev");