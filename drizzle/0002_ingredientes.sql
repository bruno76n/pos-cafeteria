CREATE TABLE "ingredientes" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"grupo" text,
	"orden" integer NOT NULL,
	"disponible" boolean NOT NULL,
	"borrado" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"rev" bigint DEFAULT nextval('rev_global') NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ingredientes_rev_index" ON "ingredientes" USING btree ("rev");