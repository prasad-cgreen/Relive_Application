-- The admin password is stored readable (at the owner's request) instead of hashed. A hash can't be turned back into
-- the password, so the stored one is cleared: set it again with `npm run admin-password -w backend`.
DELETE FROM "admin_password";
ALTER TABLE "admin_password" RENAME COLUMN "password_hash" TO "password";
