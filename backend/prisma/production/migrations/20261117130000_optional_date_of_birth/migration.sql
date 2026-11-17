-- Date of birth is optional on the manual details form.
ALTER TABLE "user_profiles" ALTER COLUMN "date_of_birth" DROP NOT NULL;
