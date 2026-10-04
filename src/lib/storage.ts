import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { demoEnabled } from "./auth";

export const storageConfigured = Boolean(process.env.S3_BUCKET);
export const storageAvailable = storageConfigured || demoEnabled;
const localProofDirectory = join(process.cwd(), "data", "proof");
const localProofKey = /^local:[0-9a-f-]{36}$/;
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
  ...(process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}),
});

export async function saveProof(
  key: string,
  body: Buffer,
  contentType: string,
) {
  if (storageConfigured) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }
  if (!demoEnabled) throw new Error("Proof storage is unavailable.");
  if (!localProofKey.test(key)) throw new Error("Invalid proof storage key.");
  await mkdir(localProofDirectory, { recursive: true });
  await writeFile(join(localProofDirectory, key.slice(6)), body, {
    flag: "wx",
  });
  return key;
}

export async function deleteProof(key: string) {
  if (key.startsWith("local:")) {
    if (!demoEnabled || !localProofKey.test(key))
      throw new Error("Invalid proof storage key.");
    try {
      await unlink(join(localProofDirectory, key.slice(6)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  if (!storageConfigured || !key.startsWith("proof/"))
    throw new Error("Invalid proof storage key.");
  await s3.send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}

export async function readLocalProof(key: string) {
  // Only generated UUID filenames are accepted; files stay outside public/.
  if (!demoEnabled || !localProofKey.test(key)) return null;
  try {
    return await readFile(join(localProofDirectory, key.slice(6)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function proofDownloadUrl(
  key: string,
  name: string,
  inline = false,
) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    }),
    { expiresIn: 300 },
  );
}
