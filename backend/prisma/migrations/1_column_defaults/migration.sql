-- AlterTable
ALTER TABLE "luminance-estetica"."appointments" ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "reminder_sent" SET DEFAULT false;

-- AlterTable
ALTER TABLE "luminance-estetica"."availability" ALTER COLUMN "is_available" SET DEFAULT true;

-- AlterTable
ALTER TABLE "luminance-estetica"."coupons" ALTER COLUMN "min_purchase_amount" SET DEFAULT 0,
ALTER COLUMN "uses_count" SET DEFAULT 0,
ALTER COLUMN "is_active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "luminance-estetica"."payments" ALTER COLUMN "currency" SET DEFAULT 'ARS',
ALTER COLUMN "payment_method" SET DEFAULT 'MERCADOPAGO',
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "luminance-estetica"."services" ALTER COLUMN "is_active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "luminance-estetica"."users" ALTER COLUMN "is_active" SET DEFAULT true,
ALTER COLUMN "is_admin" SET DEFAULT false;

