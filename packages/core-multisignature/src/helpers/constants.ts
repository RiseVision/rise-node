export const constants = {
  multisigConstraints: {
    keysgroup: {
      maxItems: 15,
      minItems: 1,
    },
    lifetime: {
      maximum: 72,
      minimum: 1,
    },
    min: {
      maximum: 15,
      minimum: 1,
    },
  },
};

export type MultisigConstantsType = typeof constants;
