import { expect, test } from "@playwright/test";
import { MAX_PROOF_SIZE } from "../../src/lib/proof";

const proofFile = {
  name: "proof.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WkAAAAASUVORK5CYII=",
    "base64",
  ),
};

test("room creation, personal goal, proven check-in, comments, comparison and mobile layout", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find or create a room" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create a room", exact: true }),
  ).toHaveCSS("height", "28px");
  await page.screenshot({ path: "/tmp/consisthon-home.png", fullPage: true });
  await page.getByRole("link", { name: "Create a room" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await expect(
    page.getByText(/beta|demo|development|credentials/i),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/rooms\/new/);
  await page.getByLabel("Room name").fill("The test crew");
  await page
    .getByLabel("A note for your people")
    .fill("Build something useful every single day.");
  await page.getByLabel("No end date", { exact: true }).check();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page).toHaveURL(/rooms\/[^/]+\/waiting/);
  await expect(
    page.getByRole("heading", { name: "The test crew" }),
  ).toBeVisible();
  const background = page.getByRole("img", { name: /A traveler resting/ });
  await expect(background).toHaveJSProperty("complete", true);
  await expect
    .poll(() =>
      background.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "/tmp/consisthon-waiting.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Set your personal goal" }).click();
  await page.getByLabel("Topic", { exact: true }).fill("Development");
  await page.getByLabel("Project", { exact: true }).fill("Consisthon MVP");
  await page
    .getByLabel("Daily goal", { exact: true })
    .fill("Ship one useful improvement every day.");
  await page.getByLabel("Weekly milestone").fill("Finish one complete flow.");
  await page.getByLabel("Monthly milestone").fill("Launch the app to friends.");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("1/1 goals set")).toBeVisible();
  await page.getByRole("link", { name: "Enter room" }).click();
  await expect(
    page.getByText(/^(In progress|Starting soon|Completed)$/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Check in today" }).click();
  await page
    .getByLabel("What did you get done?")
    .fill("Launched the first working flow");
  await page
    .getByLabel("The story")
    .fill("Created a room, set my goal, and showed up.");
  await page.getByText("Made progress", { exact: true }).click();
  await page
    .getByLabel("Proof link", { exact: true })
    .fill("https://github.com/example/consisthon/commit/proof");
  await expect(page.getByText("Or upload proof · up to 500 KB")).toBeVisible();
  await page.getByLabel("Upload proof").setInputFiles({
    ...proofFile,
    buffer: Buffer.alloc(MAX_PROOF_SIZE + 1),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Proof files must be 500 KB or smaller.",
  );
  await page.getByLabel("Upload proof").setInputFiles(proofFile);
  await expect(page.getByText("proof.png", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/consisthon-checkin.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Submit proof" }).click();
  await expect(
    page.getByText("Checked in today.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check in today" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View proof" }).click();
  await expect(
    page.getByRole("link", { name: "Open proof link" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/example/consisthon/commit/proof",
  );
  const proofPath = await page
    .getByRole("link", { name: "Download proof" })
    .getAttribute("href");
  expect(proofPath).toBeTruthy();
  const downloaded = await page.request.get(proofPath as string);
  expect(downloaded.status()).toBe(200);
  expect(await downloaded.body()).toEqual(proofFile.buffer);
  expect(downloaded.headers()["cache-control"]).toBe("private, no-store");
  expect((await request.get(proofPath as string)).status()).toBe(403);
  await page
    .getByLabel("Comment", { exact: true })
    .fill("A small promise, kept.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(
    page.getByText("A small promise, kept.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "25", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "People & goals" }).click();
  await expect(page.getByText("Launch the app to friends.")).toBeVisible();
  await page.getByRole("button", { name: "Room rules" }).click();
  await page.getByText("Room master settings", { exact: true }).click();
  await expect(page.getByLabel("Start date", { exact: true })).toBeDisabled();
  await page.getByLabel("Room name").fill("The committed crew");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("Room updated.")).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "/tmp/consisthon-room.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/consisthon-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Streaks", exact: true }).click();
  await page.getByRole("button", { name: /25 points. Open proof/ }).click();
  await expect(
    page.getByRole("heading", { name: "Launched the first working flow" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: "/tmp/consisthon-dark.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("private invitations, open-room joins, empty search and auth boundaries", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/auth/ok");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  expect(health.ok()).toBe(true);
  const proof = await request.get("/api/proof/unknown");
  expect(proof.status()).toBe(403);
  await page.goto("/sign-in?next=/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .locator("article")
    .filter({ hasText: "The daily build" })
    .getByRole("link", { name: "Enter room" })
    .click();
  await expect(page).toHaveURL(/rooms\/the-daily-build$/);
  await expect(
    page.getByRole("heading", { name: "The daily build", level: 1 }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/consisthon-demo-room.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await page.getByLabel("Second comparison member").selectOption("demo-jules");
  await expect(
    page.getByText("A little design studio", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("link", { name: "Or explore open rooms" }).click();
  await page.getByLabel("Search rooms").fill("a room that doesn't exist");
  await expect(page.getByText("No rooms here yet.")).toBeVisible();
  await page.goto("/join/RISE2026");
  await page.getByRole("button", { name: "Sign in to join" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/join\/RISE2026/);
  await page.getByRole("button", { name: "Join this room" }).click();
  await expect(
    page.getByRole("heading", { name: "Morning momentum" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check in today" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Set your goal" }).first().click();
  await page.getByLabel("Topic", { exact: true }).fill("Reading");
  await page.getByLabel("Project", { exact: true }).fill("Morning books");
  await page
    .getByLabel("Daily goal", { exact: true })
    .fill("Read ten pages every morning.");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Room rules", exact: true }).click();
  await expect(
    page.getByText("Room master settings", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Invite people" })).toHaveCount(
    0,
  );
  await page.goto("/join/INVALID");
  await expect(
    page.getByRole("heading", { name: "This room isn't here." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("proof uploads accept 500 KB, reject larger files and enforce membership", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const upload = (size: number, roomId = "the-daily-build") =>
    page.request.post("/api/uploads", {
      headers: { origin: "http://localhost:3101" },
      multipart: {
        roomId,
        file: { ...proofFile, buffer: Buffer.alloc(size) },
      },
    });
  const accepted = await upload(MAX_PROOF_SIZE);
  expect(accepted.status()).toBe(200);
  const { id } = await accepted.json();
  const downloaded = await page.request.get(`/api/proof/${id}`);
  expect(downloaded.status()).toBe(200);
  expect((await downloaded.body()).length).toBe(MAX_PROOF_SIZE);
  expect(downloaded.headers()["content-type"]).toBe("image/png");

  const oversized = await upload(MAX_PROOF_SIZE + 1);
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toEqual({
    error: "Proof files must be 500 KB or smaller.",
  });
  expect((await upload(1, "room-without-membership")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/uploads", {
        headers: { origin: "https://another-origin.example" },
        multipart: { roomId: "the-daily-build", file: proofFile },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/uploads", {
        headers: { origin: "http://localhost:3101" },
        multipart: { roomId: "the-daily-build", file: proofFile },
      })
    ).status(),
  ).toBe(403);
  for (let i = 0; i < 2; i++) expect((await upload(1)).status()).toBe(200);
  expect((await upload(1)).status()).toBe(429);
  expect((await page.request.get(`/api/proof/${id}`)).status()).toBe(200);
});

test("sign-in redirects stay on the app for control-character return paths", async ({
  page,
  context,
}) => {
  const external: string[] = [];
  await context.route("**://attacker.example/**", (route) => {
    external.push(route.request().url());
    return route.fulfill({ status: 200, body: "Unexpected external redirect" });
  });
  await page.goto("/sign-in?next=/%09/attacker.example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3101/");
  for (const target of [
    "/\t/attacker.example",
    "/\n/attacker.example",
    "/..//attacker.example",
  ]) {
    await page.goto(`/sign-in?next=${encodeURIComponent(target)}`);
    await expect(page).toHaveURL("http://localhost:3101/");
  }
  await page.goto("/sign-in?next=/rooms");
  await expect(page).toHaveURL("http://localhost:3101/rooms");
  expect(external).toEqual([]);
});
