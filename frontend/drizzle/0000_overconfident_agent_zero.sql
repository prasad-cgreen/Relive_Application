CREATE TABLE "app_status" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"environment" text NOT NULL,
	"deployed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_status" ("id", "schema_version", "environment")
VALUES ('relive', 1, 'production');
