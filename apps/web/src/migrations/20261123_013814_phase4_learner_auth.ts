import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "_verified" boolean;
  ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  ALTER TABLE "refresh_tokens" ADD COLUMN "rotated_at" timestamp(3) with time zone;

  -- Accounts that exist before email verification was introduced must keep working: they were
  -- created by an admin or through the first-user screen, so they count as verified.
  UPDATE "users" SET "_verified" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "_verified";
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";
  ALTER TABLE "refresh_tokens" DROP COLUMN "rotated_at";`)
}
