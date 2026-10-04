import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getLinkPreview,
  isPublicAddress,
  parseLinkPreview,
  previewUrl,
} from "../src/lib/link-preview";
import { isProofImage } from "../src/lib/proof";

test("link cards use public page metadata and safely resolve relative thumbnails", () => {
  assert.deepEqual(
    parseLinkPreview(
      `
    <head><title>Fallback</title>
      <meta content='Built &amp; shipped' property='og:title'>
      <meta NAME=description content="Daily &#x70;rogress">
      <meta property="og:image" content="/cover.png">
    </head><body><meta property="og:title" content="Ignored"></body>`,
      "https://example.com/work",
    ),
    {
      title: "Built & shipped",
      description: "Daily progress",
      image: "https://example.com/cover.png",
    },
  );
  assert.deepEqual(
    parseLinkPreview(
      '<title>A simple page</title><meta property="og:image" content="javascript:alert(1)">',
      "https://example.com",
    ),
    {
      title: "A simple page",
      description: "",
      image: null,
    },
  );
});

test("preview requests reject private networks, credentials, active content, and unusual ports", async () => {
  for (const address of [
    "127.0.0.1",
    "10.1.1.1",
    "172.16.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2002:7f00:1::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(address), true, address);
  for (const url of [
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "http://[::1]",
    "http://server.internal",
    "https://name:password@example.com",
    "javascript:alert(1)",
    "http://example.com:8080",
  ])
    assert.throws(() => previewUrl(url), /Invalid preview URL/, url);
  assert.equal(await getLinkPreview("http://127.0.0.1"), null);
  assert.equal(
    previewUrl("https://example.com/work").href,
    "https://example.com/work",
  );
});

test("proof signatures accept JPEG, PNG and WebP and reject other or mislabeled files", () => {
  assert.equal(
    isProofImage(Uint8Array.from([255, 216, 255]), "image/jpeg"),
    true,
  );
  assert.equal(
    isProofImage(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
  assert.equal(isProofImage(Buffer.from("RIFF0000WEBP"), "image/webp"), true);
  for (const type of [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "video/mp4",
  ])
    assert.equal(isProofImage(Buffer.from("%PDF-1.7"), type), false);
});
