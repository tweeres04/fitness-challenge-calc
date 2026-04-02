import { useState, useMemo, useEffect } from "react";
import { CircleHelp, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { ScoringConfig, CategoryColor } from "~/lib/config-types";
import {
  createConfigHelpers,
  type ConfigHelpers,
  type CategoryCalc,
} from "~/lib/config-helpers";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DAY_NAMES_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const CATEGORY_STYLES: Record<
  CategoryColor,
  { bg: string; bar: string; headerBg: string; dot: string }
> = {
  cardio: {
    bg: "bg-cardio-50/30 dark:bg-cardio-950/30",
    bar: "bg-cardio-500",
    headerBg: "bg-cardio-50 dark:bg-cardio-950",
    dot: "bg-cardio-500",
  },
  strength: {
    bg: "bg-strength-50/30 dark:bg-strength-950/30",
    bar: "bg-strength-500",
    headerBg: "bg-strength-50 dark:bg-strength-950",
    dot: "bg-strength-500",
  },
  mobility: {
    bg: "bg-mobility-50/30 dark:bg-mobility-950/30",
    bar: "bg-mobility-500",
    headerBg: "bg-mobility-50 dark:bg-mobility-950",
    dot: "bg-mobility-500",
  },
};

type DayData = Record<string, string>;

function emptyDay(fieldKeys: string[]): DayData {
  return Object.fromEntries(fieldKeys.map((f) => [f, ""]));
}

function emptyWeek(fieldKeys: string[]): Record<string, DayData> {
  return Object.fromEntries(DAYS.map((d) => [d, emptyDay(fieldKeys)]));
}

function loadDays(
  storageKey: string,
  fieldKeys: string[],
): Record<string, DayData> {
  if (typeof window === "undefined") return emptyWeek(fieldKeys);
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored);
  } catch {}
  return emptyWeek(fieldKeys);
}

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

function NumberInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={selectOnFocus}
      className="sm:w-16 h-10 text-center max-sm:border-transparent max-sm:bg-transparent max-sm:dark:bg-transparent"
    />
  );
}

function SuggestionBlock({
  fields,
  remaining,
  totals,
  helpers,
}: {
  fields: string[];
  remaining: number;
  totals: Record<string, number>;
  helpers: ConfigHelpers;
}) {
  const primaryField = fields[0];
  const secondaryFields = fields.slice(1);
  const [secondaryValues, setSecondaryValues] = useState<
    Record<string, string>
  >({});
  const [clampedField, setClampedField] = useState<string | null>(null);

  const primaryValue = useMemo(
    () =>
      helpers.calcPrimaryValue(
        remaining,
        primaryField,
        secondaryValues,
        fields,
        totals,
      ),
    [remaining, primaryField, secondaryValues, fields, totals, helpers],
  );

  const primaryFieldConfig = helpers.getField(primaryField);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">
          {primaryFieldConfig.name}
          {primaryFieldConfig.unit && (
            <span className="block text-xs text-foreground/50">
              {primaryFieldConfig.unit}
            </span>
          )}
        </span>
        <span className="w-20 text-center tabular-nums h-7 flex items-center justify-center">
          {primaryValue > 0 ? primaryValue : "—"}
        </span>
        <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
          {primaryValue > 0
            ? `${(primaryValue * primaryFieldConfig.rate).toFixed(1)} pts`
            : ""}
        </span>
      </div>
      {secondaryFields.map((f) => {
        const fc = helpers.getField(f);
        const headroom = helpers.fieldHeadroom(f, totals);
        const maxedOut = headroom <= 0;
        const val = Math.min(parseFloat(secondaryValues[f]) || 0, headroom);
        const pts = val * fc.rate;
        return (
          <div key={f} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {fc.name}
              {fc.unit && (
                <span className="block text-xs text-foreground/50">
                  {fc.unit}
                </span>
              )}
            </span>
            {maxedOut ? (
              <Popover key="maxed">
                <PopoverTrigger className="w-20 text-center tabular-nums h-7 flex items-center justify-center text-foreground/50 cursor-help">
                  0
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-3 py-2 text-xs">
                  Already at max ({fc.max} {fc.unit || "reps"})
                </PopoverContent>
              </Popover>
            ) : (
              <Popover
                key="clamp"
                open={clampedField === f}
                onOpenChange={(open) => {
                  if (!open) setClampedField(null);
                }}
              >
                <PopoverTrigger
                  nativeButton={false}
                  render={
                    <Input
                      type="number"
                      min="0"
                      max={headroom}
                      step="any"
                      value={secondaryValues[f] ?? ""}
                      onChange={(e) =>
                        setSecondaryValues((prev) => ({
                          ...prev,
                          [f]: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v > headroom) {
                          setSecondaryValues((prev) => ({
                            ...prev,
                            [f]: String(headroom),
                          }));
                          setTimeout(() => setClampedField(f), 100);
                        }
                      }}
                      onFocus={selectOnFocus}
                      className="w-20 text-sm text-center"
                    />
                  }
                />
                <PopoverContent side="top" className="w-auto px-3 py-2 text-xs">
                  Reduced to {headroom}{" "}
                  {fc.unit || (headroom === 1 ? "rep" : "reps")}{" "}
                  remaining
                </PopoverContent>
              </Popover>
            )}
            <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
              {pts > 0 ? `${pts.toFixed(1)} pts` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryCard({
  calc,
  color,
  totals,
  helpers,
}: {
  calc: CategoryCalc;
  color: CategoryColor;
  totals: Record<string, number>;
  helpers: ConfigHelpers;
}) {
  const maxPts = helpers.config.maxCategoryPoints;
  const pct = (calc.total / maxPts) * 100;

  return (
    <Card className={CATEGORY_STYLES[color].bg}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${CATEGORY_STYLES[color].dot}`}
            />
            <CardTitle className="text-base">{calc.name}</CardTitle>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {calc.total.toFixed(1)} / {maxPts} pts
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${CATEGORY_STYLES[color].bar} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {calc.fields.map((f) => (
            <div
              key={f.field}
              className="flex justify-between text-sm tabular-nums"
            >
              <span>{f.label}</span>
              <span>
                {f.value > 0 ? f.value : "—"} → {f.points.toFixed(1)} pts
              </span>
            </div>
          ))}
        </div>

        {calc.remaining > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium">
              Suggestions ({calc.remaining.toFixed(1)} pts remaining)
            </p>
            {calc.categoryFields.length > 1 ? (
              <SuggestionBlock
                fields={calc.categoryFields}
                remaining={calc.remaining}
                totals={totals}
                helpers={helpers}
              />
            ) : (
              (() => {
                const fc = helpers.getField(calc.categoryFields[0]);
                const suggestedValue =
                  Math.round((calc.remaining / fc.rate) * 100) / 100;
                return (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {fc.name}
                      {fc.unit && (
                        <span className="block text-xs text-foreground/50">
                          {fc.unit}
                        </span>
                      )}
                    </span>
                    <span className="w-20 text-center tabular-nums h-7 flex items-center justify-center">
                      {suggestedValue}
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
                      {calc.remaining.toFixed(1)} pts
                    </span>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {calc.remaining === 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Maxed out!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RulesDialog({ helpers }: { helpers: ConfigHelpers }) {
  const { config } = helpers;
  const totalMax = config.maxCategoryPoints * config.categories.length;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost">
            <CircleHelp className="size-4" />
            <span className="hidden sm:inline">Rules</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scoring rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>
            Each week you can earn up to <strong>{totalMax} points</strong>{" "}
            across {config.categories.length} categories, each worth a maximum
            of <strong>{config.maxCategoryPoints} points</strong>.
          </p>

          {config.categories.map((cat) => (
            <div key={cat.name}>
              <h3 className="font-semibold mb-1">
                {cat.name} ({config.maxCategoryPoints} pts max)
              </h3>
              <ul className="space-y-0.5 ml-4 list-disc">
                {cat.fields.map((f) => (
                  <li key={f.key}>{helpers.fieldRuleLabel(f.key)}</li>
                ))}
              </ul>
            </div>
          ))}

          <p>
            Hit all {totalMax} points in a week to earn a{" "}
            <strong>max week bonus ticket</strong> for the prize draw.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WeeklyTracker({ config }: { config: ScoringConfig }) {
  const helpers = useMemo(() => createConfigHelpers(config), [config]);
  const { fieldKeys, fieldCategory } = helpers;

  const storageKey = `${config.slug}-weekly-tracker`;

  const [days, setDays] = useState<Record<string, DayData>>(() =>
    emptyWeek(fieldKeys),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDays(loadDays(storageKey, fieldKeys));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(days));
  }, [days, hydrated, storageKey]);

  function updateDay(day: string, field: string, value: string) {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function clearAll() {
    setDays(emptyWeek(fieldKeys));
  }

  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const f of fieldKeys) sums[f] = 0;
    for (const day of DAYS) {
      for (const field of fieldKeys) {
        sums[field] += parseFloat(days[day]?.[field]) || 0;
      }
    }
    return sums;
  }, [days, fieldKeys]);

  const categoryCalcs = useMemo(
    () =>
      config.categories.map((cat) =>
        helpers.calcCategory(
          totals,
          cat.name,
          cat.fields.map((f) => f.key),
        ),
      ),
    [totals, config.categories, helpers],
  );

  const totalPoints = categoryCalcs.reduce((sum, c) => sum + c.total, 0);
  const totalMax = config.maxCategoryPoints * config.categories.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weekly calculator</h1>
        <div className="flex items-center gap-2">
          <RulesDialog helpers={helpers} />
          <ThemeToggle />
          <Button variant="outline" onClick={clearAll}>
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Clear all</span>
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="text-xs [&_input]:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {fieldKeys.map((f) => {
                const color = fieldCategory.get(f)!;
                const gradient = helpers.getGradientClass(f, "header");
                return (
                  <TableHead
                    key={f}
                    className={`text-center ${gradient ?? CATEGORY_STYLES[color].headerBg}`}
                  >
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button className="cursor-help">
                            <span className="sm:hidden">
                              {helpers.getField(f).shortName}
                            </span>
                            <span className="hidden sm:inline">
                              {helpers.fieldLabel(f)}
                            </span>
                          </button>
                        }
                      />
                      <PopoverContent
                        side="bottom"
                        className="w-auto px-3 py-2 text-xs"
                      >
                        <p className="font-semibold">
                          {helpers.fieldLabel(f)}
                        </p>
                        <p>{helpers.fieldDescription(f)}</p>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day) => (
              <TableRow key={day}>
                <TableCell className="font-medium">
                  <span className="sm:hidden">{DAY_NAMES_SHORT[day]}</span>
                  <span className="hidden sm:inline">{day}</span>
                </TableCell>
                {fieldKeys.map((field) => {
                  const color = fieldCategory.get(field)!;
                  const gradient = helpers.getGradientClass(field, "body");
                  return (
                    <TableCell
                      key={field}
                      className={`text-center max-sm:p-0 ${gradient ?? CATEGORY_STYLES[color].bg}`}
                    >
                      <NumberInput
                        value={days[day]?.[field] ?? ""}
                        onChange={(v) => updateDay(day, field, v)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              {fieldKeys.map((f) => {
                const color = fieldCategory.get(f)!;
                const gradient = helpers.getGradientClass(f, "body");
                return (
                  <TableCell
                    key={f}
                    className={`text-center font-bold tabular-nums ${gradient ?? CATEGORY_STYLES[color].bg}`}
                  >
                    {totals[f] > 0 ? totals[f] : "—"}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Points breakdown</h2>
        <p className="text-lg font-bold tabular-nums">
          {totalPoints.toFixed(1)} / {totalMax} pts
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {config.categories.map((cat, i) => (
          <CategoryCard
            key={cat.name}
            calc={categoryCalcs[i]}
            color={cat.color}
            totals={totals}
            helpers={helpers}
          />
        ))}
      </div>
    </div>
  );
}
