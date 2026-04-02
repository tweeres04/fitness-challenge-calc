import type { Route } from "./+types/config";
import { loadConfig } from "~/lib/config-loader.server";
import { WeeklyTracker } from "~/components/weekly-tracker";
import { PageLayout } from "~/components/page-layout";

export function loader({ params }: Route.LoaderArgs) {
  return loadConfig(params.slug);
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.displayName ?? "Calculator"} | Fitness Challenge` },
    { name: "description", content: "Weekly fitness challenge calculator" },
  ];
}

export default function ConfigPage({ loaderData }: Route.ComponentProps) {
  return (
    <PageLayout>
      <WeeklyTracker config={loaderData} />
    </PageLayout>
  );
}
