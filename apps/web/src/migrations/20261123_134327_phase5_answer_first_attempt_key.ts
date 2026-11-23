import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "answer_events" ADD COLUMN "first_attempt_key" varchar;
  CREATE UNIQUE INDEX "answer_events_first_attempt_key_idx" ON "answer_events" USING btree ("first_attempt_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "answer_events_first_attempt_key_idx";
  ALTER TABLE "answer_events" DROP COLUMN "first_attempt_key";`)
}
