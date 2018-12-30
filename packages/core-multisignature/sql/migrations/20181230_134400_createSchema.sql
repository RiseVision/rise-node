BEGIN

CREATE TABLE multisignatures (
    min integer NOT NULL,
    lifetime integer NOT NULL,
    keysgroup text NOT NULL,
    "transactionId" character varying(255) NOT NULL,
    FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);


CREATE TABLE signatures (
    "transactionId" character varying(255) NOT NULL,
    "publicKey" bytea NOT NULL,
    FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE

);


CREATE INDEX IF NOT EXISTS "idx_signatures_trs_id" ON "signatures"("transactionId");
CREATE INDEX IF NOT EXISTS "idx_multisignatures_trs_id" ON "multisignatures"("transactionId");

COMMIT;