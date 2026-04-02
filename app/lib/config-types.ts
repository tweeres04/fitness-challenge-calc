export type CategoryColor = "cardio" | "strength" | "mobility";

export type FieldConfig = {
  key: string;
  name: string;
  shortName: string;
  unit?: string;
  rate: number;
  max?: number;
  integer?: boolean;
};

export type CategoryConfig = {
  name: string;
  color: CategoryColor;
  fields: FieldConfig[];
};

export type ScoringConfig = {
  slug: string;
  displayName: string;
  maxCategoryPoints: number;
  categories: CategoryConfig[];
};
