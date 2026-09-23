export type Country = {
  name: string;
  code: string;
  currency: string;
};

export type State = {
  name: string;
  code: string;
};

export type City = {
  name: string;
  code: string;
};

export const countryRaw = {
  name: { type: String },
  code: { type: String },
  currency: { type: String },
};

export const stateRaw = {
  name: { type: String },
  code: { type: String },
};

export const cityRaw = {
  name: { type: String },
  code: { type: String },
};
