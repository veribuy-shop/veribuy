-- AlterTable
ALTER TABLE "transactions"."orders" ADD COLUMN     "parcel_weight_grams" INTEGER,
ADD COLUMN     "parcel_format" TEXT,
ADD COLUMN     "shipping_label_url" TEXT,
ADD COLUMN     "dropoff_qr_code_url" TEXT,
ADD COLUMN     "dropoff_point_id" TEXT,
ADD COLUMN     "dropoff_point_name" TEXT;
