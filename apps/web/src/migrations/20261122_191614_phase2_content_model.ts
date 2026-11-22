import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lectures_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum_lectures_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__lectures_v_version_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum__lectures_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_flashcards_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum_flashcards_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__flashcards_v_version_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum__flashcards_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_questions_difficulty" AS ENUM('easy', 'medium', 'hard');
  CREATE TYPE "public"."enum_questions_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum_questions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__questions_v_version_difficulty" AS ENUM('easy', 'medium', 'hard');
  CREATE TYPE "public"."enum__questions_v_version_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum__questions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_papers_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum_papers_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__papers_v_version_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum__papers_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_videos_provider" AS ENUM('youtube', 'vimeo', 'other');
  CREATE TYPE "public"."enum_videos_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum_videos_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__videos_v_version_provider" AS ENUM('youtube', 'vimeo', 'other');
  CREATE TYPE "public"."enum__videos_v_version_access_tier" AS ENUM('free', 'premium');
  CREATE TYPE "public"."enum__videos_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_answer_events_selected_label" AS ENUM('A', 'B', 'C', 'D', 'E', 'F');
  CREATE TYPE "public"."enum_refresh_tokens_audience" AS ENUM('web', 'mobile');
  CREATE TABLE "lectures_citations" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "lectures" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"cover_image_id" uuid,
  	"body" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"last_reviewed_at" timestamp(3) with time zone,
  	"access_tier" "enum_lectures_access_tier" DEFAULT 'free',
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_lectures_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "lectures_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"domains_id" uuid
  );
  
  CREATE TABLE "_lectures_v_version_citations" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_lectures_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_cover_image_id" uuid,
  	"version_body" jsonb,
  	"version_published_at" timestamp(3) with time zone,
  	"version_last_reviewed_at" timestamp(3) with time zone,
  	"version_access_tier" "enum__lectures_v_version_access_tier" DEFAULT 'free',
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__lectures_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_lectures_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"domains_id" uuid
  );
  
  CREATE TABLE "flashcards" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"front" varchar,
  	"front_image_id" uuid,
  	"back" jsonb,
  	"topic_id" uuid,
  	"domain_id" uuid,
  	"access_tier" "enum_flashcards_access_tier" DEFAULT 'free',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_flashcards_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "flashcards_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_flashcards_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_front" varchar,
  	"version_front_image_id" uuid,
  	"version_back" jsonb,
  	"version_topic_id" uuid,
  	"version_domain_id" uuid,
  	"version_access_tier" "enum__flashcards_v_version_access_tier" DEFAULT 'free',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__flashcards_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_flashcards_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "questions_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"text" varchar,
  	"is_correct" boolean DEFAULT false,
  	"explanation" jsonb
  );
  
  CREATE TABLE "questions_citations" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "questions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"vignette" jsonb,
  	"stem" varchar,
  	"overall_explanation" jsonb,
  	"topic_id" uuid,
  	"domain_id" uuid,
  	"difficulty" "enum_questions_difficulty" DEFAULT 'medium',
  	"access_tier" "enum_questions_access_tier" DEFAULT 'free',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_questions_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_questions_v_version_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"label" varchar,
  	"text" varchar,
  	"is_correct" boolean DEFAULT false,
  	"explanation" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_questions_v_version_citations" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_questions_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_vignette" jsonb,
  	"version_stem" varchar,
  	"version_overall_explanation" jsonb,
  	"version_topic_id" uuid,
  	"version_domain_id" uuid,
  	"version_difficulty" "enum__questions_v_version_difficulty" DEFAULT 'medium',
  	"version_access_tier" "enum__questions_v_version_access_tier" DEFAULT 'free',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__questions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "papers" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"journal" varchar,
  	"year" numeric,
  	"doi" varchar,
  	"pubmed_url" varchar,
  	"citation_count" numeric,
  	"lead_author_h_index" numeric,
  	"clinical_relevance" numeric,
  	"abstract" jsonb,
  	"spark_notes" jsonb,
  	"domain_id" uuid,
  	"access_tier" "enum_papers_access_tier" DEFAULT 'free',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_papers_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "papers_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_papers_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_journal" varchar,
  	"version_year" numeric,
  	"version_doi" varchar,
  	"version_pubmed_url" varchar,
  	"version_citation_count" numeric,
  	"version_lead_author_h_index" numeric,
  	"version_clinical_relevance" numeric,
  	"version_abstract" jsonb,
  	"version_spark_notes" jsonb,
  	"version_domain_id" uuid,
  	"version_access_tier" "enum__papers_v_version_access_tier" DEFAULT 'free',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__papers_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_papers_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "videos" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"embed_url" varchar,
  	"provider" "enum_videos_provider",
  	"provider_video_id" varchar,
  	"description" jsonb,
  	"thumbnail_id" uuid,
  	"domain_id" uuid,
  	"duration_seconds" numeric,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewed_by_id" uuid,
  	"access_tier" "enum_videos_access_tier" DEFAULT 'free',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_videos_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_videos_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_embed_url" varchar,
  	"version_provider" "enum__videos_v_version_provider",
  	"version_provider_video_id" varchar,
  	"version_description" jsonb,
  	"version_thumbnail_id" uuid,
  	"version_domain_id" uuid,
  	"version_duration_seconds" numeric,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_reviewed_by_id" uuid,
  	"version_access_tier" "enum__videos_v_version_access_tier" DEFAULT 'free',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__videos_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "domains" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"parent_id" uuid,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"domain_id" uuid NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "answer_events" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"question_id" uuid NOT NULL,
  	"selected_label" "enum_answer_events_selected_label" NOT NULL,
  	"is_correct" boolean DEFAULT false NOT NULL,
  	"is_first_attempt" boolean DEFAULT false NOT NULL,
  	"domain_id" uuid,
  	"topic_id" uuid,
  	"answered_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "refresh_tokens" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"audience" "enum_refresh_tokens_audience" NOT NULL,
  	"family_id" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"revoked_at" timestamp(3) with time zone,
  	"device_label" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lectures_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "flashcards_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "questions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "papers_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "domains_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "topics_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "answer_events_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "refresh_tokens_id" uuid;
  ALTER TABLE "lectures_citations" ADD CONSTRAINT "lectures_citations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lectures" ADD CONSTRAINT "lectures_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lectures_rels" ADD CONSTRAINT "lectures_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lectures_rels" ADD CONSTRAINT "lectures_rels_domains_fk" FOREIGN KEY ("domains_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lectures_v_version_citations" ADD CONSTRAINT "_lectures_v_version_citations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_lectures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lectures_v" ADD CONSTRAINT "_lectures_v_parent_id_lectures_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lectures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lectures_v" ADD CONSTRAINT "_lectures_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lectures_v_rels" ADD CONSTRAINT "_lectures_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_lectures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lectures_v_rels" ADD CONSTRAINT "_lectures_v_rels_domains_fk" FOREIGN KEY ("domains_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_front_image_id_media_id_fk" FOREIGN KEY ("front_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flashcards_texts" ADD CONSTRAINT "flashcards_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_flashcards_v" ADD CONSTRAINT "_flashcards_v_parent_id_flashcards_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."flashcards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flashcards_v" ADD CONSTRAINT "_flashcards_v_version_front_image_id_media_id_fk" FOREIGN KEY ("version_front_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flashcards_v" ADD CONSTRAINT "_flashcards_v_version_topic_id_topics_id_fk" FOREIGN KEY ("version_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flashcards_v" ADD CONSTRAINT "_flashcards_v_version_domain_id_domains_id_fk" FOREIGN KEY ("version_domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_flashcards_v_texts" ADD CONSTRAINT "_flashcards_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_flashcards_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questions_choices" ADD CONSTRAINT "questions_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questions_citations" ADD CONSTRAINT "questions_citations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "questions" ADD CONSTRAINT "questions_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_questions_v_version_choices" ADD CONSTRAINT "_questions_v_version_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_questions_v_version_citations" ADD CONSTRAINT "_questions_v_version_citations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_questions_v" ADD CONSTRAINT "_questions_v_parent_id_questions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_questions_v" ADD CONSTRAINT "_questions_v_version_topic_id_topics_id_fk" FOREIGN KEY ("version_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_questions_v" ADD CONSTRAINT "_questions_v_version_domain_id_domains_id_fk" FOREIGN KEY ("version_domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers" ADD CONSTRAINT "papers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers_texts" ADD CONSTRAINT "papers_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_papers_v" ADD CONSTRAINT "_papers_v_parent_id_papers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."papers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_papers_v" ADD CONSTRAINT "_papers_v_version_domain_id_domains_id_fk" FOREIGN KEY ("version_domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_papers_v_texts" ADD CONSTRAINT "_papers_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_papers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_videos_v" ADD CONSTRAINT "_videos_v_parent_id_videos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_videos_v" ADD CONSTRAINT "_videos_v_version_thumbnail_id_media_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_videos_v" ADD CONSTRAINT "_videos_v_version_domain_id_domains_id_fk" FOREIGN KEY ("version_domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_videos_v" ADD CONSTRAINT "_videos_v_version_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "domains" ADD CONSTRAINT "domains_parent_id_domains_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lectures_citations_order_idx" ON "lectures_citations" USING btree ("_order");
  CREATE INDEX "lectures_citations_parent_id_idx" ON "lectures_citations" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "lectures_slug_idx" ON "lectures" USING btree ("slug");
  CREATE INDEX "lectures_cover_image_idx" ON "lectures" USING btree ("cover_image_id");
  CREATE INDEX "lectures_updated_at_idx" ON "lectures" USING btree ("updated_at");
  CREATE INDEX "lectures_created_at_idx" ON "lectures" USING btree ("created_at");
  CREATE INDEX "lectures__status_idx" ON "lectures" USING btree ("_status");
  CREATE INDEX "lectures_rels_order_idx" ON "lectures_rels" USING btree ("order");
  CREATE INDEX "lectures_rels_parent_idx" ON "lectures_rels" USING btree ("parent_id");
  CREATE INDEX "lectures_rels_path_idx" ON "lectures_rels" USING btree ("path");
  CREATE INDEX "lectures_rels_domains_id_idx" ON "lectures_rels" USING btree ("domains_id");
  CREATE INDEX "_lectures_v_version_citations_order_idx" ON "_lectures_v_version_citations" USING btree ("_order");
  CREATE INDEX "_lectures_v_version_citations_parent_id_idx" ON "_lectures_v_version_citations" USING btree ("_parent_id");
  CREATE INDEX "_lectures_v_parent_idx" ON "_lectures_v" USING btree ("parent_id");
  CREATE INDEX "_lectures_v_version_version_slug_idx" ON "_lectures_v" USING btree ("version_slug");
  CREATE INDEX "_lectures_v_version_version_cover_image_idx" ON "_lectures_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_lectures_v_version_version_updated_at_idx" ON "_lectures_v" USING btree ("version_updated_at");
  CREATE INDEX "_lectures_v_version_version_created_at_idx" ON "_lectures_v" USING btree ("version_created_at");
  CREATE INDEX "_lectures_v_version_version__status_idx" ON "_lectures_v" USING btree ("version__status");
  CREATE INDEX "_lectures_v_created_at_idx" ON "_lectures_v" USING btree ("created_at");
  CREATE INDEX "_lectures_v_updated_at_idx" ON "_lectures_v" USING btree ("updated_at");
  CREATE INDEX "_lectures_v_latest_idx" ON "_lectures_v" USING btree ("latest");
  CREATE INDEX "_lectures_v_rels_order_idx" ON "_lectures_v_rels" USING btree ("order");
  CREATE INDEX "_lectures_v_rels_parent_idx" ON "_lectures_v_rels" USING btree ("parent_id");
  CREATE INDEX "_lectures_v_rels_path_idx" ON "_lectures_v_rels" USING btree ("path");
  CREATE INDEX "_lectures_v_rels_domains_id_idx" ON "_lectures_v_rels" USING btree ("domains_id");
  CREATE INDEX "flashcards_front_image_idx" ON "flashcards" USING btree ("front_image_id");
  CREATE INDEX "flashcards_topic_idx" ON "flashcards" USING btree ("topic_id");
  CREATE INDEX "flashcards_domain_idx" ON "flashcards" USING btree ("domain_id");
  CREATE INDEX "flashcards_updated_at_idx" ON "flashcards" USING btree ("updated_at");
  CREATE INDEX "flashcards_created_at_idx" ON "flashcards" USING btree ("created_at");
  CREATE INDEX "flashcards__status_idx" ON "flashcards" USING btree ("_status");
  CREATE INDEX "flashcards_texts_order_parent" ON "flashcards_texts" USING btree ("order","parent_id");
  CREATE INDEX "_flashcards_v_parent_idx" ON "_flashcards_v" USING btree ("parent_id");
  CREATE INDEX "_flashcards_v_version_version_front_image_idx" ON "_flashcards_v" USING btree ("version_front_image_id");
  CREATE INDEX "_flashcards_v_version_version_topic_idx" ON "_flashcards_v" USING btree ("version_topic_id");
  CREATE INDEX "_flashcards_v_version_version_domain_idx" ON "_flashcards_v" USING btree ("version_domain_id");
  CREATE INDEX "_flashcards_v_version_version_updated_at_idx" ON "_flashcards_v" USING btree ("version_updated_at");
  CREATE INDEX "_flashcards_v_version_version_created_at_idx" ON "_flashcards_v" USING btree ("version_created_at");
  CREATE INDEX "_flashcards_v_version_version__status_idx" ON "_flashcards_v" USING btree ("version__status");
  CREATE INDEX "_flashcards_v_created_at_idx" ON "_flashcards_v" USING btree ("created_at");
  CREATE INDEX "_flashcards_v_updated_at_idx" ON "_flashcards_v" USING btree ("updated_at");
  CREATE INDEX "_flashcards_v_latest_idx" ON "_flashcards_v" USING btree ("latest");
  CREATE INDEX "_flashcards_v_texts_order_parent" ON "_flashcards_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "questions_choices_order_idx" ON "questions_choices" USING btree ("_order");
  CREATE INDEX "questions_choices_parent_id_idx" ON "questions_choices" USING btree ("_parent_id");
  CREATE INDEX "questions_citations_order_idx" ON "questions_citations" USING btree ("_order");
  CREATE INDEX "questions_citations_parent_id_idx" ON "questions_citations" USING btree ("_parent_id");
  CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic_id");
  CREATE INDEX "questions_domain_idx" ON "questions" USING btree ("domain_id");
  CREATE INDEX "questions_updated_at_idx" ON "questions" USING btree ("updated_at");
  CREATE INDEX "questions_created_at_idx" ON "questions" USING btree ("created_at");
  CREATE INDEX "questions__status_idx" ON "questions" USING btree ("_status");
  CREATE INDEX "_questions_v_version_choices_order_idx" ON "_questions_v_version_choices" USING btree ("_order");
  CREATE INDEX "_questions_v_version_choices_parent_id_idx" ON "_questions_v_version_choices" USING btree ("_parent_id");
  CREATE INDEX "_questions_v_version_citations_order_idx" ON "_questions_v_version_citations" USING btree ("_order");
  CREATE INDEX "_questions_v_version_citations_parent_id_idx" ON "_questions_v_version_citations" USING btree ("_parent_id");
  CREATE INDEX "_questions_v_parent_idx" ON "_questions_v" USING btree ("parent_id");
  CREATE INDEX "_questions_v_version_version_topic_idx" ON "_questions_v" USING btree ("version_topic_id");
  CREATE INDEX "_questions_v_version_version_domain_idx" ON "_questions_v" USING btree ("version_domain_id");
  CREATE INDEX "_questions_v_version_version_updated_at_idx" ON "_questions_v" USING btree ("version_updated_at");
  CREATE INDEX "_questions_v_version_version_created_at_idx" ON "_questions_v" USING btree ("version_created_at");
  CREATE INDEX "_questions_v_version_version__status_idx" ON "_questions_v" USING btree ("version__status");
  CREATE INDEX "_questions_v_created_at_idx" ON "_questions_v" USING btree ("created_at");
  CREATE INDEX "_questions_v_updated_at_idx" ON "_questions_v" USING btree ("updated_at");
  CREATE INDEX "_questions_v_latest_idx" ON "_questions_v" USING btree ("latest");
  CREATE UNIQUE INDEX "papers_slug_idx" ON "papers" USING btree ("slug");
  CREATE INDEX "papers_domain_idx" ON "papers" USING btree ("domain_id");
  CREATE INDEX "papers_updated_at_idx" ON "papers" USING btree ("updated_at");
  CREATE INDEX "papers_created_at_idx" ON "papers" USING btree ("created_at");
  CREATE INDEX "papers__status_idx" ON "papers" USING btree ("_status");
  CREATE INDEX "papers_texts_order_parent" ON "papers_texts" USING btree ("order","parent_id");
  CREATE INDEX "_papers_v_parent_idx" ON "_papers_v" USING btree ("parent_id");
  CREATE INDEX "_papers_v_version_version_slug_idx" ON "_papers_v" USING btree ("version_slug");
  CREATE INDEX "_papers_v_version_version_domain_idx" ON "_papers_v" USING btree ("version_domain_id");
  CREATE INDEX "_papers_v_version_version_updated_at_idx" ON "_papers_v" USING btree ("version_updated_at");
  CREATE INDEX "_papers_v_version_version_created_at_idx" ON "_papers_v" USING btree ("version_created_at");
  CREATE INDEX "_papers_v_version_version__status_idx" ON "_papers_v" USING btree ("version__status");
  CREATE INDEX "_papers_v_created_at_idx" ON "_papers_v" USING btree ("created_at");
  CREATE INDEX "_papers_v_updated_at_idx" ON "_papers_v" USING btree ("updated_at");
  CREATE INDEX "_papers_v_latest_idx" ON "_papers_v" USING btree ("latest");
  CREATE INDEX "_papers_v_texts_order_parent" ON "_papers_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "videos_slug_idx" ON "videos" USING btree ("slug");
  CREATE INDEX "videos_thumbnail_idx" ON "videos" USING btree ("thumbnail_id");
  CREATE INDEX "videos_domain_idx" ON "videos" USING btree ("domain_id");
  CREATE INDEX "videos_reviewed_by_idx" ON "videos" USING btree ("reviewed_by_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  CREATE INDEX "videos__status_idx" ON "videos" USING btree ("_status");
  CREATE INDEX "_videos_v_parent_idx" ON "_videos_v" USING btree ("parent_id");
  CREATE INDEX "_videos_v_version_version_slug_idx" ON "_videos_v" USING btree ("version_slug");
  CREATE INDEX "_videos_v_version_version_thumbnail_idx" ON "_videos_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_videos_v_version_version_domain_idx" ON "_videos_v" USING btree ("version_domain_id");
  CREATE INDEX "_videos_v_version_version_reviewed_by_idx" ON "_videos_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_videos_v_version_version_updated_at_idx" ON "_videos_v" USING btree ("version_updated_at");
  CREATE INDEX "_videos_v_version_version_created_at_idx" ON "_videos_v" USING btree ("version_created_at");
  CREATE INDEX "_videos_v_version_version__status_idx" ON "_videos_v" USING btree ("version__status");
  CREATE INDEX "_videos_v_created_at_idx" ON "_videos_v" USING btree ("created_at");
  CREATE INDEX "_videos_v_updated_at_idx" ON "_videos_v" USING btree ("updated_at");
  CREATE INDEX "_videos_v_latest_idx" ON "_videos_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE UNIQUE INDEX "domains_slug_idx" ON "domains" USING btree ("slug");
  CREATE INDEX "domains_parent_idx" ON "domains" USING btree ("parent_id");
  CREATE INDEX "domains_updated_at_idx" ON "domains" USING btree ("updated_at");
  CREATE INDEX "domains_created_at_idx" ON "domains" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_domain_idx" ON "topics" USING btree ("domain_id");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE INDEX "answer_events_user_idx" ON "answer_events" USING btree ("user_id");
  CREATE INDEX "answer_events_question_idx" ON "answer_events" USING btree ("question_id");
  CREATE INDEX "answer_events_domain_idx" ON "answer_events" USING btree ("domain_id");
  CREATE INDEX "answer_events_topic_idx" ON "answer_events" USING btree ("topic_id");
  CREATE INDEX "answer_events_answered_at_idx" ON "answer_events" USING btree ("answered_at");
  CREATE INDEX "answer_events_updated_at_idx" ON "answer_events" USING btree ("updated_at");
  CREATE INDEX "answer_events_created_at_idx" ON "answer_events" USING btree ("created_at");
  CREATE INDEX "user_question_idx" ON "answer_events" USING btree ("user_id","question_id");
  CREATE INDEX "user_answeredAt_idx" ON "answer_events" USING btree ("user_id","answered_at");
  CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");
  CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");
  CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");
  CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");
  CREATE INDEX "refresh_tokens_updated_at_idx" ON "refresh_tokens" USING btree ("updated_at");
  CREATE INDEX "refresh_tokens_created_at_idx" ON "refresh_tokens" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lectures_fk" FOREIGN KEY ("lectures_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_flashcards_fk" FOREIGN KEY ("flashcards_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_questions_fk" FOREIGN KEY ("questions_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_domains_fk" FOREIGN KEY ("domains_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_answer_events_fk" FOREIGN KEY ("answer_events_id") REFERENCES "public"."answer_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_refresh_tokens_fk" FOREIGN KEY ("refresh_tokens_id") REFERENCES "public"."refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_lectures_id_idx" ON "payload_locked_documents_rels" USING btree ("lectures_id");
  CREATE INDEX "payload_locked_documents_rels_flashcards_id_idx" ON "payload_locked_documents_rels" USING btree ("flashcards_id");
  CREATE INDEX "payload_locked_documents_rels_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("questions_id");
  CREATE INDEX "payload_locked_documents_rels_papers_id_idx" ON "payload_locked_documents_rels" USING btree ("papers_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_domains_id_idx" ON "payload_locked_documents_rels" USING btree ("domains_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_answer_events_id_idx" ON "payload_locked_documents_rels" USING btree ("answer_events_id");
  CREATE INDEX "payload_locked_documents_rels_refresh_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("refresh_tokens_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lectures_citations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lectures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lectures_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lectures_v_version_citations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lectures_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lectures_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "flashcards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "flashcards_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_flashcards_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_flashcards_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questions_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questions_citations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_questions_v_version_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_questions_v_version_citations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_questions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "papers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "papers_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_papers_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_papers_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_videos_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "answer_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "refresh_tokens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "lectures_citations" CASCADE;
  DROP TABLE "lectures" CASCADE;
  DROP TABLE "lectures_rels" CASCADE;
  DROP TABLE "_lectures_v_version_citations" CASCADE;
  DROP TABLE "_lectures_v" CASCADE;
  DROP TABLE "_lectures_v_rels" CASCADE;
  DROP TABLE "flashcards" CASCADE;
  DROP TABLE "flashcards_texts" CASCADE;
  DROP TABLE "_flashcards_v" CASCADE;
  DROP TABLE "_flashcards_v_texts" CASCADE;
  DROP TABLE "questions_choices" CASCADE;
  DROP TABLE "questions_citations" CASCADE;
  DROP TABLE "questions" CASCADE;
  DROP TABLE "_questions_v_version_choices" CASCADE;
  DROP TABLE "_questions_v_version_citations" CASCADE;
  DROP TABLE "_questions_v" CASCADE;
  DROP TABLE "papers" CASCADE;
  DROP TABLE "papers_texts" CASCADE;
  DROP TABLE "_papers_v" CASCADE;
  DROP TABLE "_papers_v_texts" CASCADE;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "_videos_v" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "domains" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "answer_events" CASCADE;
  DROP TABLE "refresh_tokens" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lectures_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_flashcards_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_questions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_papers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_videos_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_domains_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_topics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_answer_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_refresh_tokens_fk";
  
  DROP INDEX "payload_locked_documents_rels_lectures_id_idx";
  DROP INDEX "payload_locked_documents_rels_flashcards_id_idx";
  DROP INDEX "payload_locked_documents_rels_questions_id_idx";
  DROP INDEX "payload_locked_documents_rels_papers_id_idx";
  DROP INDEX "payload_locked_documents_rels_videos_id_idx";
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_domains_id_idx";
  DROP INDEX "payload_locked_documents_rels_topics_id_idx";
  DROP INDEX "payload_locked_documents_rels_answer_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_refresh_tokens_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lectures_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "flashcards_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "questions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "papers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "domains_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "topics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "answer_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "refresh_tokens_id";
  DROP TYPE "public"."enum_lectures_access_tier";
  DROP TYPE "public"."enum_lectures_status";
  DROP TYPE "public"."enum__lectures_v_version_access_tier";
  DROP TYPE "public"."enum__lectures_v_version_status";
  DROP TYPE "public"."enum_flashcards_access_tier";
  DROP TYPE "public"."enum_flashcards_status";
  DROP TYPE "public"."enum__flashcards_v_version_access_tier";
  DROP TYPE "public"."enum__flashcards_v_version_status";
  DROP TYPE "public"."enum_questions_difficulty";
  DROP TYPE "public"."enum_questions_access_tier";
  DROP TYPE "public"."enum_questions_status";
  DROP TYPE "public"."enum__questions_v_version_difficulty";
  DROP TYPE "public"."enum__questions_v_version_access_tier";
  DROP TYPE "public"."enum__questions_v_version_status";
  DROP TYPE "public"."enum_papers_access_tier";
  DROP TYPE "public"."enum_papers_status";
  DROP TYPE "public"."enum__papers_v_version_access_tier";
  DROP TYPE "public"."enum__papers_v_version_status";
  DROP TYPE "public"."enum_videos_provider";
  DROP TYPE "public"."enum_videos_access_tier";
  DROP TYPE "public"."enum_videos_status";
  DROP TYPE "public"."enum__videos_v_version_provider";
  DROP TYPE "public"."enum__videos_v_version_access_tier";
  DROP TYPE "public"."enum__videos_v_version_status";
  DROP TYPE "public"."enum_answer_events_selected_label";
  DROP TYPE "public"."enum_refresh_tokens_audience";`)
}
