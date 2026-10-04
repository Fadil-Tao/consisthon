import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export type LinkPreview = {
  title: string;
  description: string;
  image: string | null;
};

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix);
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return (
    family === 6 &&
    globalIPv6.check(address, "ipv6") &&
    !blocked.check(address, "ipv6")
  );
}

export function previewUrl(value: string, base?: string) {
  if (value.length > 2000) throw new Error("Invalid preview URL.");
  const url = new URL(value, base);
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    (!isIP(host) &&
      (!host.includes(".") ||
        /\.(?:localhost|local|internal)\.?$/i.test(host))) ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new Error("Invalid preview URL.");
  return url;
}

function text(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return value
    .replace(
      /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
      (match, entity: string) => {
        if (!entity.startsWith("#"))
          return entities[entity.toLowerCase()] || match;
        const code =
          entity[1].toLowerCase() === "x"
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function parseLinkPreview(html: string, url: string): LinkPreview {
  // Preview metadata lives in the document head; never execute or render site HTML.
  const head = html
    .split(/<\/head\s*>/i)[0]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\s[^>]*>/gi) || []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    ))
      attributes.set(
        match[1].toLowerCase(),
        text(match[2] ?? match[3] ?? match[4]),
      );
    const key = attributes.get("property") || attributes.get("name");
    if (key && attributes.has("content") && !meta.has(key.toLowerCase()))
      meta.set(key.toLowerCase(), attributes.get("content") || "");
  }
  const title =
    meta.get("og:title") ||
    meta.get("twitter:title") ||
    text(head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || "");
  const description =
    meta.get("og:description") ||
    meta.get("twitter:description") ||
    meta.get("description") ||
    "";
  let image: string | null = null;
  const candidate = meta.get("og:image") || meta.get("twitter:image");
  if (candidate) {
    try {
      image = previewUrl(candidate, url).href;
    } catch {
      /* Text-only preview. */
    }
  }
  return {
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image,
  };
}

async function readPage(url: URL, signal: AbortSignal) {
  return new Promise<{ html: string; location?: string }>((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(
      url,
      {
        signal,
        agent: false,
        headers: {
          Accept: "text/html",
          "User-Agent": "Consisthon-Link-Preview/1.0",
          "Accept-Encoding": "identity",
        },
        // Pin the validated DNS result to this connection, including every redirect.
        lookup: (hostname, _options, callback) => {
          lookup(hostname, { all: true })
            .then((addresses) => {
              if (
                !addresses.length ||
                addresses.some((a) => !isPublicAddress(a.address))
              )
                throw new Error("Private preview address.");
              callback(
                null,
                _options.all ? [addresses[0]] : addresses[0].address,
                addresses[0].family,
              );
            })
            .catch((error) => callback(error, "", 4));
        },
      },
      (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.destroy();
          resolve({ html: "", location: res.headers.location });
          return;
        }
        if (
          res.statusCode !== 200 ||
          !res.headers["content-type"]?.includes("text/html")
        ) {
          res.destroy();
          reject(new Error("No page preview."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk.subarray(0, Math.max(0, 256 * 1024 - size)));
          size += chunk.length;
          if (size >= 256 * 1024) {
            resolve({ html: Buffer.concat(chunks).toString("utf8") });
            res.destroy();
          }
        });
        res.on("end", () =>
          resolve({ html: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function getLinkPreview(
  value: string,
): Promise<LinkPreview | null> {
  try {
    let url = previewUrl(value);
    const signal = AbortSignal.timeout(4000);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const page = await readPage(url, signal);
      if (!page.location) return parseLinkPreview(page.html, url.href);
      url = previewUrl(page.location, url.href);
    }
  } catch {
    /* Links still work when a site has no public metadata. */
  }
  return null;
}
