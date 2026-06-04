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

function mp3Response(): Response {
  const body = new Uint8Array(1024);
  body.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  return new Response(body, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}

describe("Merriam-Webster desktop API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches default Youdao pronunciation audio over HTTPS with American pronunciation", async () => {
    mocks.apiFetch.mockResolvedValueOnce(mp3Response());

    const blob = await fetchPronunciation("Hello,", "youdao");

    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBe(1024);
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "https://dict.youdao.com/dictvoice?type=2&audio=hello",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects a non-audio Youdao response before handing it to Howler", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("<html>blocked</html>", {
        headers: {
          "Content-Type": "text/html",
        },
      }),
    );

    await expect(fetchPronunciation("hello", "youdao")).rejects.toThrow(
      "Youdao returned invalid audio",
    );
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
      .mockResolvedValueOnce(mp3Response());

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
