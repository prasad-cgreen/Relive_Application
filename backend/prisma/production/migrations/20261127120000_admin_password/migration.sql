-- The agents admin page password (hashed), replacing the ADMIN_PASSWORD setting.
-- CreateTable
CREATE TABLE "admin_password" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "password_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_password_pkey" PRIMARY KEY ("id")
);


-- A single shared password: only row 1 may exist.
ALTER TABLE "admin_password" ADD CONSTRAINT "admin_password_single_row" CHECK ("id" = 1);
