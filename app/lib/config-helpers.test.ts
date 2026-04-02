import { describe, it, expect } from "vitest";
import { createConfigHelpers } from "./config-helpers";
import { loadConfig } from "./config-loader.server";

const conradConfig = loadConfig("conrad");

function zeroTotals(): Record<string, number> {
  const h = createConfigHelpers(conradConfig);
  return Object.fromEntries(h.fieldKeys.map((k) => [k, 0]));
}

describe("createConfigHelpers", () => {
  const h = createConfigHelpers(conradConfig);

  describe("fieldKeys and fieldMap", () => {
    it("lists all field keys in category order", () => {
      expect(h.fieldKeys).toEqual([
        "running", "biking", "sessionHrs", "heavy", "light", "mobility",
      ]);
    });

    it("maps keys to field configs", () => {
      expect(h.getField("running").rate).toBe(2);
      expect(h.getField("light").integer).toBe(true);
      expect(h.getField("mobility").unit).toBe("min");
    });
  });

  describe("fieldLabel", () => {
    it("includes unit when present", () => {
      expect(h.fieldLabel("running")).toBe("Running (km)");
    });

    it("omits unit when absent", () => {
      expect(h.fieldLabel("heavy")).toBe("Heavy reps");
    });
  });

  describe("fieldDescription", () => {
    it("shows rate only for uncapped fields", () => {
      expect(h.fieldDescription("running")).toBe("2 pts/km");
    });

    it("includes max for capped fields", () => {
      expect(h.fieldDescription("biking")).toBe("0.25 pts/km, max 40");
    });

    it("defaults to 'rep' when no unit", () => {
      expect(h.fieldDescription("heavy")).toBe("0.1 pts/rep");
    });
  });

  describe("fieldRuleLabel", () => {
    it("uncapped field", () => {
      expect(h.fieldRuleLabel("running")).toBe("Running: 2 pts/km");
    });

    it("capped field with plural", () => {
      expect(h.fieldRuleLabel("biking")).toBe(
        "Biking: 0.25 pts/km (max 40 kms, 10 pts)",
      );
    });

    it("capped field with singular max", () => {
      // sessionHrs has max 2, so plural
      // light has max 200 reps
      expect(h.fieldRuleLabel("light")).toBe(
        "Light reps: 0.05 pts/rep (max 200 reps, 10 pts)",
      );
    });
  });

  describe("fieldMax", () => {
    it("returns Infinity for uncapped fields", () => {
      expect(h.fieldMax("running")).toBe(Infinity);
    });

    it("returns the cap for capped fields", () => {
      expect(h.fieldMax("biking")).toBe(40);
    });
  });

  describe("fieldHeadroom", () => {
    it("returns full max when nothing tracked", () => {
      const totals = zeroTotals();
      expect(h.fieldHeadroom("biking", totals)).toBe(40);
    });

    it("subtracts what's already tracked", () => {
      const totals = { ...zeroTotals(), biking: 25 };
      expect(h.fieldHeadroom("biking", totals)).toBe(15);
    });

    it("floors at zero when over max", () => {
      const totals = { ...zeroTotals(), biking: 50 };
      expect(h.fieldHeadroom("biking", totals)).toBe(0);
    });

    it("returns Infinity for uncapped fields with zero tracked", () => {
      const totals = zeroTotals();
      expect(h.fieldHeadroom("running", totals)).toBe(Infinity);
    });
  });

  describe("calcCategory", () => {
    it("calculates points from totals", () => {
      const totals = { ...zeroTotals(), running: 5, biking: 10 };
      const result = h.calcCategory(totals, "Cardio", [
        "running", "biking", "sessionHrs",
      ]);
      // running: 5km * 2 = 10pts, biking: 10km * 0.25 = 2.5pts
      expect(result.total).toBe(12.5);
      expect(result.remaining).toBe(7.5);
    });

    it("clamps total to maxCategoryPoints", () => {
      const totals = { ...zeroTotals(), running: 15 };
      const result = h.calcCategory(totals, "Cardio", [
        "running", "biking", "sessionHrs",
      ]);
      // running: 15km * 2 = 30pts, capped at 20
      expect(result.total).toBe(20);
      expect(result.remaining).toBe(0);
    });

    it("clamps per-field values to field max", () => {
      const totals = { ...zeroTotals(), biking: 100 };
      const result = h.calcCategory(totals, "Cardio", [
        "running", "biking", "sessionHrs",
      ]);
      // biking: 100km but max 40, so 40 * 0.25 = 10pts
      expect(result.total).toBe(10);
      expect(result.fields[1].points).toBe(10);
    });

    it("reports raw value even when clamped", () => {
      const totals = { ...zeroTotals(), biking: 100 };
      const result = h.calcCategory(totals, "Cardio", [
        "running", "biking", "sessionHrs",
      ]);
      expect(result.fields[1].value).toBe(100);
    });
  });

  describe("calcPrimaryValue", () => {
    const totals = zeroTotals();

    it("calculates primary from remaining points", () => {
      // 20pts remaining, running at 2pts/km = 10km
      const result = h.calcPrimaryValue(20, "running", {}, [
        "running", "biking", "sessionHrs",
      ], totals);
      expect(result).toBe(10);
    });

    it("subtracts secondary field points", () => {
      // 20pts remaining, biking 10km = 2.5pts, leaves 17.5pts
      // running: 17.5 / 2 = 8.75km
      const result = h.calcPrimaryValue(20, "running", { biking: "10" }, [
        "running", "biking", "sessionHrs",
      ], totals);
      expect(result).toBe(8.75);
    });

    it("respects primary field headroom", () => {
      // sessionHrs has max 2, already tracked 1.5 = headroom 0.5
      const totalsWithSession = { ...totals, sessionHrs: 1.5 };
      const result = h.calcPrimaryValue(20, "sessionHrs", {}, [
        "running", "biking", "sessionHrs",
      ], totalsWithSession);
      // 20pts / 2pts/hr = 10hrs, but headroom is 0.5
      expect(result).toBe(0.5);
    });

    it("clamps secondary values to their headroom", () => {
      // biking has max 40, already tracked 35 = headroom 5
      const totalsWithBiking = { ...totals, biking: 35 };
      // User enters 20 for biking secondary, but headroom is 5
      // So secondary pts = 5 * 0.25 = 1.25
      // Primary (running) = (20 - 1.25) / 2 = 9.375
      const result = h.calcPrimaryValue(20, "running", { biking: "20" }, [
        "running", "biking", "sessionHrs",
      ], totalsWithBiking);
      expect(result).toBe(9.38); // rounded to 2 decimal places
    });

    it("ceils integer fields", () => {
      // heavy at 0.1pts/rep, 5pts remaining = 50 reps
      const result = h.calcPrimaryValue(5, "heavy", {}, [
        "heavy", "light",
      ], totals);
      expect(result).toBe(50);

      // 5.5pts remaining = 55 reps exactly
      const result2 = h.calcPrimaryValue(5.5, "heavy", {}, [
        "heavy", "light",
      ], totals);
      expect(result2).toBe(55);

      // 5.3pts remaining = 53 reps, ceil
      const result3 = h.calcPrimaryValue(5.3, "heavy", {}, [
        "heavy", "light",
      ], totals);
      expect(result3).toBe(53);
    });

    it("returns zero when no points remaining", () => {
      const result = h.calcPrimaryValue(0, "running", {}, [
        "running", "biking", "sessionHrs",
      ], totals);
      expect(result).toBe(0);
    });
  });

  describe("getGradientClass", () => {
    it("returns start gradient for first field in multi-field category", () => {
      expect(h.getGradientClass("running", "header")).toBe(
        "bg-gradient-cardio-start-header",
      );
    });

    it("returns end gradient for last field in multi-field category", () => {
      expect(h.getGradientClass("sessionHrs", "body")).toBe(
        "bg-gradient-cardio-end-body",
      );
    });

    it("returns null for middle fields", () => {
      expect(h.getGradientClass("biking", "header")).toBeNull();
    });

    it("returns start gradient for single-field category", () => {
      expect(h.getGradientClass("mobility", "header")).toBe(
        "bg-gradient-mobility-start-header",
      );
    });

    it("supports body variant", () => {
      expect(h.getGradientClass("heavy", "body")).toBe(
        "bg-gradient-strength-start-body",
      );
      expect(h.getGradientClass("light", "body")).toBe(
        "bg-gradient-strength-end-body",
      );
    });
  });
});
