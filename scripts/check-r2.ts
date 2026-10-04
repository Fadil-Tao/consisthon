import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
const required = [
  "S3_BUCKET",
  "S3_ENDPOINT",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Set ${missing.join(", ")} before checking R2.`);
  process.exit(1);
}

const client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint,
  forcePathStyle: true,
});
const key = `proof/_connection-check/${randomUUID()}`;
const body = Buffer.from("Consisthon private proof storage check.\n");
let uploaded = false;
try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    }),
  );
  uploaded = true;
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: "attachment; filename=proof.txt",
    }),
    { expiresIn: 60 },
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(body))
    throw new Error("Signed download did not return the uploaded file.");
  const unsigned = await fetch(`${endpoint}/${bucket}/${key}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (![401, 403, 404].includes(unsigned.status))
    throw new Error("Unsigned access was not denied.");
  console.log("R2 upload, signed download, and private access checks passed.");
} catch (error) {
  // Do not log signed URLs, credentials, or SDK request details.
  console.error(
    `R2 check failed (${error instanceof Error ? error.name : "UnknownError"}). Check the endpoint, keys, and bucket's Object Read & Write permissions.`,
  );
  process.exitCode = 1;
} finally {
  if (uploaded) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log("Removed the connection-check file.");
    } catch {
      console.error(`Remove the connection-check object manually: ${key}`);
      process.exitCode = 1;
    }
  }
  client.destroy();
}
