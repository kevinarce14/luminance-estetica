-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "luminance-estetica";

-- CreateEnum
CREATE TYPE "luminance-estetica"."appointmentstatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "luminance-estetica"."discounttype" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "luminance-estetica"."paymentmethod" AS ENUM ('MERCADOPAGO', 'CASH', 'TRANSFER', 'CARD_POS');

-- CreateEnum
CREATE TYPE "luminance-estetica"."paymentstatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "luminance-estetica"."appointments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "appointment_date" TIMESTAMP(6) NOT NULL,
    "status" "luminance-estetica"."appointmentstatus" NOT NULL,
    "notes" TEXT,
    "reminder_sent" BOOLEAN NOT NULL,
    "cancelled_at" TIMESTAMP(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luminance-estetica"."availability" (
    "id" SERIAL NOT NULL,
    "day_of_week" INTEGER,
    "specific_date" DATE,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "is_available" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luminance-estetica"."coupons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "discount_type" "luminance-estetica"."discounttype" NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "min_purchase_amount" DOUBLE PRECISION NOT NULL,
    "max_uses" INTEGER,
    "uses_count" INTEGER NOT NULL,
    "valid_from" DATE,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luminance-estetica"."payments" (
    "id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "payment_method" "luminance-estetica"."paymentmethod" NOT NULL,
    "status" "luminance-estetica"."paymentstatus" NOT NULL,
    "mercadopago_id" VARCHAR(255),
    "mercadopago_preference_id" VARCHAR(255),
    "transaction_id" VARCHAR(255),
    "payment_details" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luminance-estetica"."services" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "image_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luminance-estetica"."users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "hashed_password" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "is_admin" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_appointments_appointment_date" ON "luminance-estetica"."appointments"("appointment_date" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_appointments_id" ON "luminance-estetica"."appointments"("id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_appointments_service_id" ON "luminance-estetica"."appointments"("service_id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_appointments_status" ON "luminance-estetica"."appointments"("status" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_appointments_user_id" ON "luminance-estetica"."appointments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_availability_day_of_week" ON "luminance-estetica"."availability"("day_of_week" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_availability_id" ON "luminance-estetica"."availability"("id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_availability_specific_date" ON "luminance-estetica"."availability"("specific_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ix_luminance-estetica_coupons_code" ON "luminance-estetica"."coupons"("code" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_coupons_id" ON "luminance-estetica"."coupons"("id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ix_luminance-estetica_payments_appointment_id" ON "luminance-estetica"."payments"("appointment_id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_payments_id" ON "luminance-estetica"."payments"("id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_payments_mercadopago_id" ON "luminance-estetica"."payments"("mercadopago_id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_payments_status" ON "luminance-estetica"."payments"("status" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_payments_user_id" ON "luminance-estetica"."payments"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "luminance-estetica"."payments"("transaction_id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_services_category" ON "luminance-estetica"."services"("category" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_services_id" ON "luminance-estetica"."services"("id" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_services_name" ON "luminance-estetica"."services"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ix_luminance-estetica_users_email" ON "luminance-estetica"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "ix_luminance-estetica_users_id" ON "luminance-estetica"."users"("id" ASC);

-- AddForeignKey
ALTER TABLE "luminance-estetica"."appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "luminance-estetica"."services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "luminance-estetica"."appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "luminance-estetica"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "luminance-estetica"."payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "luminance-estetica"."appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "luminance-estetica"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "luminance-estetica"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

