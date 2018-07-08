BEGIN;

ALTER TABLE forks_stat
  RENAME COLUMN "delegatePublicKey"  TO "generatorPublicKey";


COMMIT;

