import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMwStress,
  fetchPronunciation,
  testMw,
} from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/tauri-http", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("Merriam-Webster desktop API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encodes API keys before placing them in dictionary query URLs", async () => {
    const mwKey = "abc&def=1 #space";
    const encodedKey = encodeURIComponent(mwKey);
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ meta: { id: "hello" } }])),
    );

    await testMw(mwKey);

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      `https://dictionaryapi.com/api/v3/references/collegiate/json/hello?key=${encodedKey}`,
    );
  });

  it("uses encoded Merriam-Webster keys for audio lookup", async () => {
    const mwKey = "abc&def=1 #space";
    const encodedKey = encodeURIComponent(mwKey);
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              hwi: {
                prs: [{ sound: { audio: "hello01" } }],
              },
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(new Response("audio"));

    await fetchPronunciation("hello", "merriam-webster", mwKey);

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      `https://dictionaryapi.com/api/v3/references/collegiate/json/hello?key=${encodedKey}`,
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "https://media.merriam-webster.com/audio/prons/en/us/mp3/h/hello01.mp3",
    );
  });

  it("uses encoded Merriam-Webster keys for stress lookup", async () => {
    const mwKey = "abc&def=1 #space";
    const encodedKey = encodeURIComponent(mwKey);
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            hwi: {
              prs: [{ mw: "ˈhe-lō" }],
            },
          },
        ]),
      ),
    );

    await fetchMwStress("hello", mwKey);

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      `https://dictionaryapi.com/api/v3/references/collegiate/json/hello?key=${encodedKey}`,
    );
  });
});
