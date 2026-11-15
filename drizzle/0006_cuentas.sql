CREATE TABLE "cuentas_venta" (
	"id" text PRIMARY KEY NOT NULL,
	"dispositivo_id" text NOT NULL,
	"dispositivo_nombre" text NOT NULL,
	"turno_id" text NOT NULL,
	"dia" date NOT NULL,
	"numero" integer NOT NULL,
	"nombre" text,
	"estado" text NOT NULL,
	"venta_id" text,
	"cancelacion" jsonb,
	"abierta_por" jsonb NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" text PRIMARY KEY NOT NULL,
	"cuenta_id" text NOT NULL,
	"numero" integer NOT NULL,
	"tipo" text NOT NULL,
	"lineas" jsonb NOT NULL,
	"enviado_por" jsonb NOT NULL,
	"autorizado_por" jsonb,
	"fecha" timestamp with time zone NOT NULL,
	"dia" date NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "cuenta_id" text;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "cuenta_numero" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "cuenta_comandas" integer;--> statement-breakpoint
CREATE INDEX "cuentas_venta_estado_index" ON "cuentas_venta" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "cuentas_venta_dia_index" ON "cuentas_venta" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "cuentas_venta_rev_index" ON "cuentas_venta" USING btree ("rev");--> statement-breakpoint
CREATE INDEX "pedidos_cuenta_id_index" ON "pedidos" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX "pedidos_dia_index" ON "pedidos" USING btree ("dia");--> statement-breakpoint
CREATE INDEX "pedidos_rev_index" ON "pedidos" USING btree ("rev");--> statement-breakpoint
CREATE UNIQUE INDEX "ventas_cuenta_id_index" ON "ventas" USING btree ("cuenta_id");