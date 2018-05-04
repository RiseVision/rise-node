BEGIN;

DROP VIEW IF EXISTS trs_list;

ALTER TABLE trs
  ADD COLUMN height INT;

UPDATE trs
  SET height = (SELECT height from blocks where blocks.id = trs."blockId");

ALTER TABLE trs
  ALTER COLUMN height SET NOT NULL;

COMMIT;