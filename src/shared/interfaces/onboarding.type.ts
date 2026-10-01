export interface StageTracker {
  step: string;
  version?: string;
  updatedAt?: Date;
  completed?: boolean;
}

export const StageTrackerSchemaRaw = {
  step: { type: String, required: true },
  version: { type: String, default: 'v1' },
  updatedAt: { type: Date, default: () => new Date() },
  completed: { type: Boolean, default: false },
};
