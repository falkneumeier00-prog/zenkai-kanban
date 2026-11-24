CREATE TYPE "public"."antrag_status" AS ENUM('offen', 'genehmigt', 'abgelehnt');--> statement-breakpoint
CREATE TYPE "public"."eintrag_art" AS ENUM('macht', 'hilft_mit');--> statement-breakpoint
CREATE TYPE "public"."mitglied_status" AS ENUM('aktiv', 'ehemalig', 'gefallen', 'ausgeblendet');--> statement-breakpoint
CREATE TYPE "public"."prioritaet" AS ENUM('niedrig', 'normal', 'hoch');--> statement-breakpoint
CREATE TYPE "public"."spalte" AS ENUM('idee', 'offen', 'in_arbeit', 'pruefung', 'erledigt');--> statement-breakpoint
CREATE TABLE "bereich" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"farbe" text NOT NULL,
	"reihenfolge" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bereich_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "eintrag" (
	"karte_id" integer NOT NULL,
	"mitglied_id" integer NOT NULL,
	"art" "eintrag_art" NOT NULL,
	"seit" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eintrag_karte_id_mitglied_id_pk" PRIMARY KEY("karte_id","mitglied_id")
);
--> statement-breakpoint
CREATE TABLE "karte" (
	"id" serial PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text DEFAULT '' NOT NULL,
	"bereich_id" integer,
	"projekt" text,
	"spalte" "spalte" DEFAULT 'idee' NOT NULL,
	"prioritaet" "prioritaet" DEFAULT 'normal' NOT NULL,
	"frist" date,
	"blockiert" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"erstellt_von" integer NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"geaendert_am" timestamp with time zone DEFAULT now() NOT NULL,
	"archiviert_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kommentar" (
	"id" serial PRIMARY KEY NOT NULL,
	"karte_id" integer NOT NULL,
	"mitglied_id" integer NOT NULL,
	"text" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"zurueckgezogen" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link" (
	"id" serial PRIMARY KEY NOT NULL,
	"karte_id" integer NOT NULL,
	"titel" text NOT NULL,
	"url" text NOT NULL,
	"mitglied_id" integer NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mitglied" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bereich_id" integer,
	"mudra_hash" text,
	"status" "mitglied_status" DEFAULT 'aktiv' NOT NULL,
	"fehlversuche" integer DEFAULT 0 NOT NULL,
	"gesperrt_bis" timestamp with time zone,
	"sitzungs_version" integer DEFAULT 1 NOT NULL,
	"eingetragen_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruecksetzantrag" (
	"id" serial PRIMARY KEY NOT NULL,
	"mitglied_id" integer NOT NULL,
	"beantragt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "antrag_status" DEFAULT 'offen' NOT NULL,
	"entschieden_von" integer,
	"entschieden_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tor_versuch" (
	"ip" text PRIMARY KEY NOT NULL,
	"anzahl" integer DEFAULT 0 NOT NULL,
	"fenster_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verlauf" (
	"id" serial PRIMARY KEY NOT NULL,
	"zeit" timestamp with time zone DEFAULT now() NOT NULL,
	"mitglied_id" integer,
	"karte_id" integer,
	"aktion" text NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
ALTER TABLE "eintrag" ADD CONSTRAINT "eintrag_karte_id_karte_id_fk" FOREIGN KEY ("karte_id") REFERENCES "public"."karte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eintrag" ADD CONSTRAINT "eintrag_mitglied_id_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte" ADD CONSTRAINT "karte_bereich_id_bereich_id_fk" FOREIGN KEY ("bereich_id") REFERENCES "public"."bereich"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karte" ADD CONSTRAINT "karte_erstellt_von_mitglied_id_fk" FOREIGN KEY ("erstellt_von") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_karte_id_karte_id_fk" FOREIGN KEY ("karte_id") REFERENCES "public"."karte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kommentar" ADD CONSTRAINT "kommentar_mitglied_id_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_karte_id_karte_id_fk" FOREIGN KEY ("karte_id") REFERENCES "public"."karte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_mitglied_id_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitglied" ADD CONSTRAINT "mitglied_bereich_id_bereich_id_fk" FOREIGN KEY ("bereich_id") REFERENCES "public"."bereich"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruecksetzantrag" ADD CONSTRAINT "ruecksetzantrag_mitglied_id_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruecksetzantrag" ADD CONSTRAINT "ruecksetzantrag_entschieden_von_mitglied_id_fk" FOREIGN KEY ("entschieden_von") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlauf" ADD CONSTRAINT "verlauf_mitglied_id_mitglied_id_fk" FOREIGN KEY ("mitglied_id") REFERENCES "public"."mitglied"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlauf" ADD CONSTRAINT "verlauf_karte_id_karte_id_fk" FOREIGN KEY ("karte_id") REFERENCES "public"."karte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "karte_spalte" ON "karte" USING btree ("spalte");--> statement-breakpoint
CREATE UNIQUE INDEX "mitglied_name_lower" ON "mitglied" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "verlauf_karte" ON "verlauf" USING btree ("karte_id");