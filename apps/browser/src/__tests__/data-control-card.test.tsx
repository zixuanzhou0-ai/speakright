import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataControlCard } from "@/components/settings/data-control-card";
import { getInitialLocalDataSummary } from "@/lib/data-registry";
import {
  LOCAL_DATA_SCHEMA_VERSION,
  runLocalDataMigrations,
} from "@/lib/local-data-migrations";

describe("DataControlCard hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("keeps the first render independent of client storage", () => {
    const initialSummary = getInitialLocalDataSummary();
    const markup = renderToString(<DataControlCard />).replaceAll(
      "<!-- -->",
      "",
    );

    expect(markup).toContain(`>v${initialSummary.dataSchemaVersion}</p>`);
    expect(initialSummary).toMatchObject({
      learningKeys: 0,
      cacheKeys: 0,
      configuredApiKeys: 0,
      apiKeySlots: 3,
      corruptItems: 0,
    });
  });

  it("refreshes after the startup migration event", async () => {
    render(<DataControlCard />);
    await waitFor(() => expect(screen.getByText("v0")).toBeInTheDocument());

    act(() => runLocalDataMigrations());

    await waitFor(() => {
      expect(
        screen.getByText(`v${LOCAL_DATA_SCHEMA_VERSION}`),
      ).toBeInTheDocument();
    });
  });
});
