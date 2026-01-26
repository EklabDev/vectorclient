CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_name" varchar(255) NOT NULL,
	"token_value" text NOT NULL,
	"token_prefix" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "api_tokens_token_value_unique" UNIQUE("token_value")
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"api_token_id" uuid,
	"method" varchar(10) NOT NULL,
	"path" varchar(1024) NOT NULL,
	"status" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"response_time" integer NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoint_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"api_token_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoint_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"schema_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"route_name" varchar(255) NOT NULL,
	"route" varchar(255) NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"rate_limit_window_ms" integer DEFAULT 60000 NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forwarding_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer NOT NULL,
	"flow_type" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"weaviate_collection_id" varchar(255),
	"version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schemas_weaviate_collection_id_unique" UNIQUE("weaviate_collection_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_api_token_id_api_tokens_id_fk" FOREIGN KEY ("api_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_api_tokens" ADD CONSTRAINT "endpoint_api_tokens_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_api_tokens" ADD CONSTRAINT "endpoint_api_tokens_api_token_id_api_tokens_id_fk" FOREIGN KEY ("api_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_schemas" ADD CONSTRAINT "endpoint_schemas_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoint_schemas" ADD CONSTRAINT "endpoint_schemas_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_flows" ADD CONSTRAINT "forwarding_flows_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemas" ADD CONSTRAINT "schemas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_token_value_idx" ON "api_tokens" USING btree ("token_value");--> statement-breakpoint
CREATE INDEX "call_logs_endpoint_id_created_idx" ON "call_logs" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "call_logs_status_idx" ON "call_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "endpoint_api_tokens_endpoint_id_idx" ON "endpoint_api_tokens" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "endpoint_api_tokens_api_token_id_idx" ON "endpoint_api_tokens" USING btree ("api_token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_api_tokens_unique_idx" ON "endpoint_api_tokens" USING btree ("endpoint_id","api_token_id");--> statement-breakpoint
CREATE INDEX "endpoint_schemas_endpoint_id_idx" ON "endpoint_schemas" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "endpoint_schemas_schema_id_idx" ON "endpoint_schemas" USING btree ("schema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_schemas_unique_idx" ON "endpoint_schemas" USING btree ("endpoint_id","schema_id");--> statement-breakpoint
CREATE INDEX "endpoints_user_id_idx" ON "endpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "endpoints_route_idx" ON "endpoints" USING btree ("route");--> statement-breakpoint
CREATE INDEX "endpoints_user_route_idx" ON "endpoints" USING btree ("user_id","route");--> statement-breakpoint
CREATE INDEX "forwarding_flows_endpoint_id_idx" ON "forwarding_flows" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "schemas_user_id_idx" ON "schemas" USING btree ("user_id");