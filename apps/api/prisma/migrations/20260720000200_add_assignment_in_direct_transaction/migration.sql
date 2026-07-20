-- A custody holder may return assigned property to its accounting owner.
-- The destination is then the owner's DIRECT bucket, not a CustodyBalance row.
ALTER TYPE "StockTransactionType" ADD VALUE 'ASSIGNMENT_IN_DIRECT';
