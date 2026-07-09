ALTER TABLE "products"
ADD COLUMN "popularity_score" DOUBLE PRECISION,
ADD COLUMN "popularity_rank" INTEGER,
ADD COLUMN "popularity_source" TEXT,
ADD COLUMN "popularity_checked_at" TIMESTAMP(3);
