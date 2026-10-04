import { expect, test } from "@playwright/test";
import { addDays } from "../../src/lib/domain";
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
  const landingBackground = page.getByRole("img", {
    name: /A traveler resting/,
  });
  await expect
    .poll(() =>
      landingBackground.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: "/tmp/consisthon-home-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/consisthon-home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
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
  await page.route("**/api/link-preview?**", (route) =>
    route.fulfill({
      json: {
        preview: {
          title: "Consisthon · daily progress",
          description: "A proof of the work shipped today.",
          image: "/waiting-room.png",
        },
      },
    }),
  );
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
  await expect(
    page.getByRole("link", { name: "Open proof link" }),
  ).toContainText("Consisthon · daily progress");
  await expect(
    page.getByText("Or upload an image · up to 500 KB"),
  ).toBeVisible();
  await expect(page.getByLabel("Upload proof")).toHaveAttribute(
    "accept",
    "image/jpeg,image/png,image/webp",
  );
  await page.getByLabel("Upload proof").setInputFiles({
    name: "proof.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Use a JPG, PNG, or WebP image.",
  );
  await page.getByLabel("Upload proof").setInputFiles({
    ...proofFile,
    buffer: Buffer.alloc(MAX_PROOF_SIZE + 1),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Proof images must be 500 KB or smaller.",
  );
  await page.getByLabel("Upload proof").setInputFiles(proofFile);
  await expect(page.getByText("proof.png", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Proof image preview" })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
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
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Proof image preview" })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
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
  const previewPath = `${proofPath}?preview=1`;
  const previewResponse = await page.request.get(previewPath);
  expect(previewResponse.headers()["content-disposition"]).toMatch(/^inline;/);
  expect(previewResponse.headers()["cache-control"]).toBe("private, no-store");
  expect((await request.get(previewPath)).status()).toBe(403);
  await page
    .getByLabel("Comment", { exact: true })
    .fill("A small promise, kept.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(
    page.getByText("A small promise, kept.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.unroute("**/api/link-preview?**");
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "25", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "People & goals" }).click();
  await expect(page.getByText("Launch the app to friends.")).toBeVisible();
  await page.getByRole("button", { name: "Room rules" }).click();
  await page.getByText("Room master settings", { exact: true }).click();
  await expect(page.getByLabel("Start date", { exact: true })).toBeEnabled();
  const startDate = await page
    .getByLabel("Start date", { exact: true })
    .inputValue();
  await page.getByLabel("Room name").fill("The committed crew");
  await page
    .getByLabel("A note for your people")
    .fill("Updated rules for our daily progress.");
  await page.getByLabel("Who can find this room?").selectOption("public");
  await page
    .getByLabel("Start date", { exact: true })
    .fill(addDays(startDate, -1));
  await page.getByLabel("No end date", { exact: true }).uncheck();
  await page
    .getByLabel("End date", { exact: true })
    .fill(addDays(startDate, 7));
  await page.getByLabel("Room timezone").fill("Asia/Singapore");
  await page.getByLabel("Level 2 name").fill("Focused progress");
  await page.getByLabel("Level 2 points").fill("40");
  await page
    .getByLabel("Level 2 proof requirement")
    .fill("A screenshot of one completed task.");
  await page.getByLabel("Fine per missed day").fill("12.50");
  await page.getByLabel("Currency", { exact: true }).selectOption("USD");
  await page
    .getByLabel("External consequence")
    .fill("Miss three days? Buy the crew a coffee.");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("Room updated.")).toBeVisible();
  await expect(page.getByText("$12.50", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("complementary")
      .getByText("Miss three days? Buy the crew a coffee.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Room rules", exact: true }).click();
  await page.getByText("Room master settings", { exact: true }).click();
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue(
    addDays(startDate, -1),
  );
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    addDays(startDate, 7),
  );
  await expect(page.getByLabel("Room timezone")).toHaveValue("Asia/Singapore");
  await expect(page.getByLabel("Level 2 points")).toHaveValue("40");
  await expect(page.getByLabel("Fine per missed day")).toHaveValue("12.5");
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "25", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "People & goals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit your goal", exact: true })
    .click();
  await page
    .getByLabel("Daily goal", { exact: true })
    .fill("Ship one useful improvement and show the result.");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
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
  await page.getByRole("button", { name: "Room rules", exact: true }).click();
  await page.getByText("Room master settings", { exact: true }).click();
  await page.getByLabel("Level 1 points").fill("70");
  await page.getByRole("button", { name: "Save room", exact: true }).click();
  await expect(page.getByText("Room updated.")).toBeVisible();
  await page
    .getByRole("button", { name: "Check in today", exact: true })
    .click();
  await page
    .getByLabel("What did you get done?")
    .fill("Followed the updated point rules");
  await page
    .getByLabel("Proof link", { exact: true })
    .fill("https://example.com/proof");
  await page.getByRole("button", { name: "Submit proof · +70 points" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByText("Checked in today.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Followed the updated point rules",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("+70 points earned");
  await page.getByRole("button", { name: "Close", exact: true }).click();
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
  await page
    .getByRole("button", { name: "People & goals", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^(Ban|Kick) / })).toHaveCount(
    0,
  );
  await page.goto("/join/INVALID");
  await expect(
    page.getByRole("heading", { name: "This room isn't here." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("proof uploads accept images up to 500 KB and enforce type, membership and quotas", async ({
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
        file: {
          ...proofFile,
          buffer: Buffer.concat([
            proofFile.buffer,
            Buffer.alloc(Math.max(0, size - proofFile.buffer.length)),
          ]),
        },
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
    error: "Proof images must be 500 KB or smaller.",
  });
  for (const mimeType of [
    "application/pdf",
    "video/mp4",
    "image/svg+xml",
    "image/png",
  ]) {
    const invalid = await page.request.post("/api/uploads", {
      headers: { origin: "http://localhost:3101" },
      multipart: {
        roomId: "the-daily-build",
        file: { name: "proof", mimeType, buffer: Buffer.from("%PDF-1.7") },
      },
    });
    expect(invalid.status()).toBe(400);
  }
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
  expect(
    (
      await request.get(
        "/api/link-preview?roomId=the-daily-build&url=https://example.com",
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(
        "/api/link-preview?roomId=unknown&url=https://example.com",
      )
    ).status(),
  ).toBe(403);
  const privatePreview = await page.request.get(
    "/api/link-preview?roomId=the-daily-build&url=http://127.0.0.1",
  );
  expect(privatePreview.status()).toBe(200);
  expect(await privatePreview.json()).toEqual({ preview: null });
});

test("room master has separate kick and ban controls and removals persist", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3101/");
  await page.goto("/rooms/the-daily-build");
  await page
    .getByRole("button", { name: "People & goals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "People & goals", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ban Alex Morgan" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Kick Alex Morgan" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/consisthon-member-actions.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Kick Sam Rivera", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kick Sam Rivera?" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("can join again");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kick Sam Rivera", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Kick Sam Rivera", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kick member", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sam Rivera", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("3 members", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Ban Jules Chen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ban Jules Chen?" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("cannot join again");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ban Jules Chen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ban Jules Chen", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ban member", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Jules Chen", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("2 members", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.getByLabel("Second comparison member")).not.toHaveValue(
    "demo-jules",
  );
  await expect(
    page
      .locator(".panel")
      .filter({ has: page.getByRole("heading", { name: "Side by side" }) })
      .getByRole("heading", { level: 3 }),
  ).toHaveCount(2);
  await page.reload();
  await page
    .getByRole("button", { name: "People & goals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jules Chen", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Sam Rivera", exact: true }),
  ).toHaveCount(0);
  await page.goto("/join/BUILD2026");
  await expect(page).toHaveURL(/rooms\/the-daily-build$/);
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
