# Consisthon

A little better, together. A consistency challenge app with private or public rooms, personal projects, proof-based daily check-ins, GitHub-style streaks, comments, rankings, comparisons, and missed-day fines.

Built with Next.js App Router, React, Better Auth (Google), Turso/libSQL, Drizzle, shadcn-style UI primitives, Tailwind CSS, and private S3 proof storage. The zinc tokens, 28px controls, focus rings, and corner radii follow the Plied agent worktree's design system. Room status badges are omitted. The supplied landscape is used on the landing page and in the waiting room, with a tinted landing overlay and solid panels for contrast.

## Run locally

Node 22+ and pnpm are required.

```sh
pnpm install
cp .env.example .env
# Replace BETTER_AUTH_SECRET with the output of: openssl rand -hex 32
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000. Choose **Sign in → Continue** to enter the sample workspace without configuring cloud services. This local access requires `ENABLE_DEMO=true`, a local `file:` database, and development mode. It is disabled in production. `pnpm db:seed` also creates the sample rooms; it never replaces existing data.

The project already has an ignored local `.env`, migrated local database, and sample rooms in this workspace. No cloud credentials are included.

## Google login

Create a Google OAuth **Web application** client. Add these authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://your-domain.example/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in your environment. Restart the app. Sign-in and account creation share the same Google button. The server validates sessions and room membership for every protected read and mutation. See [Better Auth's Google setup](https://better-auth.com/docs/authentication/google).

## Turso database

Set `TURSO_DATABASE_URL=libsql://your-database.turso.io` and `TURSO_AUTH_TOKEN`, then run `pnpm db:migrate`. Local development uses the same Drizzle schema against `file:./data/consisthon.db`. Schema changes use `pnpm db:generate` followed by `pnpm db:migrate`. The checked-in migration creates both the auth and application tables.

## S3 proof files

Set `S3_BUCKET` and `AWS_REGION`, plus credentials through the AWS SDK's default credential chain (environment variables or a deployment IAM role). `S3_ENDPOINT` optionally supports an S3-compatible service such as R2. The server needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` access to the bucket's `proof/*` prefix. Delete access is needed to clean up abandoned and failed uploads. Keep the bucket private.

For Cloudflare R2, bucket operations use your Wrangler login:

```sh
pnpx wrangler r2 bucket list
# Only if the bucket does not already exist:
pnpx wrangler r2 bucket create consisthon --location apac
pnpx wrangler r2 bucket info consisthon
```

Wrangler's OAuth login does not supply the S3 credentials used by the Next.js server. In **R2 → Account Details → Manage API Tokens**, create an R2 token with **Object Read & Write** scoped to the `consisthon` bucket. Copy its **Access Key ID** and **Secret Access Key** into the ignored `.env`:

```dotenv
AWS_REGION=auto
S3_BUCKET=consisthon
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
```

Run `pnpm storage:check` to verify upload, signed downloads, and denied unsigned access. The check removes its temporary object. Restart `pnpm dev` after changing credentials. Do not enable an `r2.dev` URL or a public custom domain for proof files; browser CORS is unnecessary because uploads go through the application server. See [R2 CLI setup](https://developers.cloudflare.com/r2/get-started/cli/), [R2 token permissions](https://developers.cloudflare.com/r2/api/tokens/), and [AWS SDK configuration for R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

Uploads go through the authenticated application server, so browser bucket CORS is not required. Supported images: JPG, PNG, WebP; maximum size: 500 KB (512,000 bytes), enforced in the browser and server. The server checks image signatures as well as MIME types. Stored proof IDs are scoped to the uploading user and room. Images have a private preview before submission and in check-in details. Downloads and previews require room membership and receive a five-minute signed URL. See the [AWS SDK S3 examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).

Proof links show a clickable preview before submission and in check-in details. Public page titles, descriptions, and thumbnails appear when available; sites that block previews or require sign-in keep a simple link card. Preview requests require room membership, reject private network addresses, validate redirects, and have size and time limits.

Uploads are limited per user across all rooms: three unattached files, twenty uploads per UTC day, and 100 MB of stored files. The server checks and reserves quota in a single SQL statement before writing a file, so concurrent requests share these limits. Unattached files expire after 24 hours and are removed on the owner's next upload. Files attached to check-ins remain available. Failed uploads are removed; if storage cleanup fails, their reservations remain tracked for a later cleanup attempt. A proof link can be used when upload limits are reached.

With S3 unset and local access enabled, files are stored privately in the ignored `data/proof/` directory. Downloads still require authentication and room membership. This fallback is disabled in production. Proof links remain available with either storage option.

## Room rules

- The creator is the room master and can copy invitation links or codes. Invite controls and codes are exposed only to masters in room data. Rooms are invite-only by default; public rooms appear in search. Links and codes admit members to the same room.
- Room masters can **kick** or **ban** a member from **People & goals**. Both remove access to that room, including comments, uploads, and proof previews/downloads. A kicked member can join again; a banned member is blocked from all join paths. Other rooms and saved work remain intact. Masters cannot kick or ban themselves. Run `pnpm db:migrate` when updating an existing database to add the room bans table.
- Rooms and personal goals require a start date. End dates are optional in an infinite room. A finite room bounds its members' personal goal dates.
- Every member defines a topic, project, daily action, and optional weekly/monthly milestones. Milestones describe the bigger goal; the daily action drives check-ins and streaks.
- One check-in per member per room day, enforced by a database unique index. A proof link or uploaded file is mandatory. The room's timezone determines the date. Past and future check-ins cannot be submitted.
- Members choose an earned proof level. Points are awarded immediately from the server's room configuration. Evidence is visible to other room members, who can comment.
- A streak stays alive until today's midnight deadline. Rankings use total points, current streak, and name to break ties. Calendar cells open their check-in and discussion.
- Fines count completed, missed calendar days within both the room's schedule and each member's personal commitment. Joining late does not create earlier fines. Today and dates after either range ends do not accrue fines. Amounts are stored in minor currency units. Changing the fine amount recalculates all displayed missed-day totals at the current rate.
- Only the room master can edit room settings, including the name, note, visibility, dates, timezone, point levels and proof requirements, fine amount, currency, and external consequences. These stay editable after goals and check-ins exist. Updated point values apply to new check-ins; existing check-ins keep their earned points. Personal goal dates remain fixed, and room date changes bound their active period without rewriting saved goals.
- External fines are written agreements handled by the group. This version tracks amounts owed; it does not collect payments or mark fines settled.

## Checks

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests use a separate test server, build directory, and fresh local database. They cover creation, invites, goals, proof submission, comments, rankings, editable rules, kicks and bans, auth boundaries, mobile overflow, and dark mode. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally points to a system Chromium installation.

Design references: [shadcn/ui theming](https://ui.shadcn.com/docs/theming) and local `~/Development/plied.com/plied-worktrees/agent/apps/web/src/app/globals.css` with its button, input, native select, and dialog components.

Google OAuth and S3 need real credentials for live end-to-end verification. Room data refreshes after actions and page navigation; live cross-browser updates are a later addition. The initial implementation loads a room's history together for small friend groups; very large rooms should paginate history and move statistics into SQL aggregates.
