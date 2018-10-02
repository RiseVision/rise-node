BEGIN;
-- Overwrite unconfirmed tables with state from confirmed tables
DELETE FROM mem_accounts2u_delegates;
INSERT INTO mem_accounts2u_delegates ("accountId", "dependentId") SELECT "accountId", "dependentId" FROM mem_accounts2delegates;

DELETE FROM mem_accounts2u_multisignatures;
INSERT INTO mem_accounts2u_multisignatures ("accountId", "dependentId") SELECT "accountId", "dependentId" FROM mem_accounts2multisignatures;
COMMIT;
