import { HydratedRouter } from "react-router/dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import mixpanel from "mixpanel-browser";

if (import.meta.env.PROD) {
  mixpanel.init("df647f17069b9dfe57e395aaacb7c281", {
    autocapture: true,
    record_sessions_percent: 100,
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
