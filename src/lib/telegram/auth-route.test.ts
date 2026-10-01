import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/telegram/auth/route";

/**
 * The 16 KB limit holds without a Content-Length: a chunked body is read only
 * up to the limit, then the stream is cancelled (no full buffering).
 */

const encoder = new TextEncoder();

function chunkedRequest(chunks: number, chunkBytes: number, pulled: { count: number }) {
  const chunk = encoder.encode("a".repeat(chunkBytes));
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) {
        controller.close();
        return;
      }
      sent += 1;
      pulled.count = sent;
      controller.enqueue(chunk);
    },
  });
  return new Request("http://localhost/api/telegram/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/telegram/auth body limit", () => {
  it("answers 413 for an oversized chunked body after reading only past the limit", async () => {
    const pulled = { count: 0 };
    // 1 000 chunks × 1 KB = ~1 MB, sent without a Content-Length.
    const response = await POST(chunkedRequest(1_000, 1024, pulled));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "payload_too_large" });
    expect(pulled.count).toBeLessThan(40);
  });

  it("counts bytes, not UTF-16 units", async () => {
    // 9 000 Cyrillic letters: under 16 K UTF-16 units, but 18 000 bytes in UTF-8.
    const text = JSON.stringify({ initData: "ж".repeat(9_000) });
    const response = await POST(
      new Request("http://localhost/api/telegram/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(text));
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit),
    );
    expect(text.length).toBeLessThan(16 * 1024);
    expect(response.status).toBe(413);
  });

  it("still reads a small JSON body", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const response = await POST(
      new Request("http://localhost/api/telegram/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: "x", locale: "uz" }),
      }),
    );
    // The body was read and parsed; the missing token then answers 503.
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "telegram_auth_not_configured" });
  });

  it("rejects malformed JSON as a bad request", async () => {
    const response = await POST(
      new Request("http://localhost/api/telegram/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/telegram/auth media type", () => {
  const post = (contentType: string) =>
    POST(
      new Request("http://localhost/api/telegram/auth", {
        method: "POST",
        headers: { "content-type": contentType },
        body: JSON.stringify({ initData: "x" }),
      }),
    );

  it("rejects a CORS-safelisted type that only mentions application/json", async () => {
    const response = await post("text/plain;application/json");
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ error: "unsupported_media_type" });
  });

  it("accepts application/json with parameters", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const response = await post("Application/JSON; charset=utf-8");
    expect(response.status).not.toBe(415);
  });
});
