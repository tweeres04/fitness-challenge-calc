import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { ScoringConfig } from "./config-types";

const CONFIGS_DIR = path.resolve(process.cwd(), "configs");

function configFiles(): string[] {
  return fs.readdirSync(CONFIGS_DIR).filter((f) => f.endsWith(".yml"));
}

export function loadConfig(slug: string): ScoringConfig {
  const file = configFiles().find((f) => f === `${slug}.yml`);
  if (!file) {
    throw new Response("Not found", { status: 404 });
  }
  const raw = fs.readFileSync(path.join(CONFIGS_DIR, file), "utf-8");
  return yaml.load(raw) as ScoringConfig;
}

export function listConfigs(): { slug: string; displayName: string }[] {
  return configFiles().map((file) => {
    const raw = fs.readFileSync(path.join(CONFIGS_DIR, file), "utf-8");
    const config = yaml.load(raw) as ScoringConfig;
    return { slug: config.slug, displayName: config.displayName };
  });
}
