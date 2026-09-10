-- Scrape sources and jobs for website crawl → Weaviate + Neo4j
CREATE TABLE IF NOT EXISTS "scrape_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "schema_id" uuid,
  "name" varchar(255) NOT NULL,
  "seed_url" text NOT NULL,
  "allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "max_depth" integer DEFAULT 2 NOT NULL,
  "max_pages" integer DEFAULT 50 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "status" varchar(50) DEFAULT 'idle' NOT NULL,
  "weaviate_collection_id" varchar(255),
  "last_crawled_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "scrape_sources_weaviate_collection_id_unique"
  ON "scrape_sources" ("weaviate_collection_id");
CREATE INDEX IF NOT EXISTS "scrape_sources_user_id_idx" ON "scrape_sources" ("user_id");

DO $$ BEGIN
  ALTER TABLE "scrape_sources" ADD CONSTRAINT "scrape_sources_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "scrape_sources" ADD CONSTRAINT "scrape_sources_schema_id_schemas_id_fk"
    FOREIGN KEY ("schema_id") REFERENCES "schemas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "scrape_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL,
  "status" varchar(50) DEFAULT 'queued' NOT NULL,
  "pages_crawled" integer DEFAULT 0 NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "scrape_jobs_source_id_idx" ON "scrape_jobs" ("source_id");

DO $$ BEGIN
  ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_source_id_scrape_sources_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "scrape_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
