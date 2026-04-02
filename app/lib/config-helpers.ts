import type {
  ScoringConfig,
  FieldConfig,
  CategoryColor,
} from "./config-types";

export type CategoryCalc = {
  name: string;
  fields: { field: string; label: string; value: number; points: number }[];
  categoryFields: string[];
  total: number;
  remaining: number;
};

export function createConfigHelpers(config: ScoringConfig) {
  const allFields = config.categories.flatMap((c) => c.fields);
  const fieldKeys = allFields.map((f) => f.key);
  const fieldMap = new Map(allFields.map((f) => [f.key, f]));

  const fieldCategory = new Map<string, CategoryColor>();
  for (const cat of config.categories) {
    for (const f of cat.fields) {
      fieldCategory.set(f.key, cat.color);
    }
  }

  function getField(key: string): FieldConfig {
    return fieldMap.get(key)!;
  }

  function fieldLabel(key: string): string {
    const f = getField(key);
    return f.unit ? `${f.name} (${f.unit})` : f.name;
  }

  function fieldDescription(key: string): string {
    const f = getField(key);
    const unit = f.unit || "rep";
    const rate = `${f.rate} pts/${unit}`;
    if (f.max == null) return rate;
    return `${rate}, max ${f.max}`;
  }

  function fieldRuleLabel(key: string): string {
    const f = getField(key);
    const unit = f.unit || "rep";
    const rate = `${f.rate} pts/${unit}`;
    if (f.max == null) return `${f.name}: ${rate}`;
    const maxPts = f.max * f.rate;
    return `${f.name}: ${rate} (max ${f.max} ${unit}${f.max !== 1 ? "s" : ""}, ${maxPts} pts)`;
  }

  function fieldMax(key: string): number {
    return getField(key).max ?? Infinity;
  }

  function isInteger(key: string): boolean {
    return getField(key).integer ?? false;
  }

  function fieldRate(key: string): number {
    return getField(key).rate;
  }

  function fieldHeadroom(key: string, totals: Record<string, number>): number {
    return Math.max(fieldMax(key) - (totals[key] || 0), 0);
  }

  function calcCategory(
    totals: Record<string, number>,
    name: string,
    fields: string[],
  ): CategoryCalc {
    const items = fields.map((key) => {
      const clamped = Math.min(totals[key] || 0, fieldMax(key));
      return {
        field: key,
        label: fieldLabel(key),
        value: totals[key] || 0,
        points: Math.min(
          clamped * fieldRate(key),
          config.maxCategoryPoints,
        ),
      };
    });

    const rawTotal = fields.reduce(
      (sum, key) =>
        sum + Math.min(totals[key] || 0, fieldMax(key)) * fieldRate(key),
      0,
    );
    const total = Math.min(rawTotal, config.maxCategoryPoints);
    const remaining = Math.max(config.maxCategoryPoints - total, 0);

    return { name, fields: items, categoryFields: fields, total, remaining };
  }

  function calcPrimaryValue(
    remaining: number,
    primaryField: string,
    secondaryValues: Record<string, string>,
    fields: string[],
    totals: Record<string, number>,
  ): number {
    const secondaryPoints = fields
      .filter((f) => f !== primaryField)
      .reduce((sum, f) => {
        const val = Math.min(
          parseFloat(secondaryValues[f]) || 0,
          fieldHeadroom(f, totals),
        );
        return sum + val * fieldRate(f);
      }, 0);

    const pointsLeft = Math.max(remaining - secondaryPoints, 0);
    const raw = Math.min(
      pointsLeft / fieldRate(primaryField),
      fieldHeadroom(primaryField, totals),
    );
    return isInteger(primaryField)
      ? Math.ceil(raw)
      : Math.round(raw * 100) / 100;
  }

  function getGradientClass(
    key: string,
    variant: "header" | "body",
  ): string | null {
    for (const cat of config.categories) {
      const keys = cat.fields.map((f) => f.key);
      if (keys.length < 2) {
        if (keys[0] === key)
          return `bg-gradient-${cat.color}-start-${variant}`;
        continue;
      }
      const idx = keys.indexOf(key);
      if (idx === 0) return `bg-gradient-${cat.color}-start-${variant}`;
      if (idx === keys.length - 1)
        return `bg-gradient-${cat.color}-end-${variant}`;
    }
    return null;
  }

  return {
    config,
    allFields,
    fieldKeys,
    fieldMap,
    fieldCategory,
    getField,
    fieldLabel,
    fieldDescription,
    fieldRuleLabel,
    fieldMax,
    isInteger,
    fieldRate,
    fieldHeadroom,
    calcCategory,
    calcPrimaryValue,
    getGradientClass,
  };
}

export type ConfigHelpers = ReturnType<typeof createConfigHelpers>;
