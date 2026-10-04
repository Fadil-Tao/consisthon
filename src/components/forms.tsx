"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
  addComment,
  createRoom,
  joinRoom,
  saveGoal,
  submitCheckin,
  updateRoom,
} from "@/app/actions";
import type { Goal, Room } from "@/db/schema";
import { DEFAULT_LEVELS, todayIn } from "@/lib/domain";
import { MAX_PROOF_SIZE, PROOF_TYPES } from "@/lib/proof";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input, Textarea } from "./ui/input";

export function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
export function FormError({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      {error}
    </p>
  ) : null;
}
function Busy({ pending }: { pending: boolean }) {
  return pending ? <Loader2 className="animate-spin" /> : <ArrowRight />;
}

export function JoinForm({
  signedIn,
  roomId,
  code,
  compact = false,
}: {
  signedIn: boolean;
  roomId?: string;
  code?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(code || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        if (!signedIn) {
          router.push(
            `/sign-in?next=${encodeURIComponent(roomId ? `/rooms` : `/join/${value.trim().toUpperCase()}`)}`,
          );
          return;
        }
        startTransition(async () => {
          const result = await joinRoom(roomId ? { roomId } : { code: value });
          if (result.ok) {
            router.push(`/rooms/${result.data.id}`);
          } else setError(result.error);
        });
      }}
    >
      {!roomId && !code ? (
        <div className="flex gap-2">
          <Input
            aria-label="Room invite code"
            placeholder="Enter an invite code"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            required
            maxLength={100}
            className="font-mono text-[11px]"
          />
          <Button
            type="submit"
            variant={compact ? "outline" : "default"}
            disabled={pending}
          >
            <Busy pending={pending} />
            <span className="sr-only">Join room</span>
          </Button>
        </div>
      ) : (
        <Button type="submit" className="w-full" disabled={pending}>
          {signedIn ? "Join this room" : "Sign in to join"}
          <Busy pending={pending} />
        </Button>
      )}
      <FormError error={error} />
    </form>
  );
}

export function RoomForm({
  room,
  locked = false,
}: {
  room?: Room;
  locked?: boolean;
}) {
  const router = useRouter();
  const [infinite, setInfinite] = useState(room ? !room.endDate : false);
  const [levels, setLevels] = useState(room?.pointLevels || DEFAULT_LEVELS);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        setSaved(false);
        const form = new FormData(e.currentTarget);
        const data = {
          title: String(form.get("title")),
          note: String(form.get("note")),
          visibility: String(form.get("visibility")),
          startDate:
            locked && room ? room.startDate : String(form.get("startDate")),
          endDate:
            locked && room
              ? room.endDate || ""
              : infinite
                ? ""
                : String(form.get("endDate")),
          timezone:
            locked && room ? room.timezone : String(form.get("timezone")),
          missedDayFine:
            locked && room
              ? room.missedDayFine / 100
              : String(form.get("missedDayFine")),
          currency:
            locked && room ? room.currency : String(form.get("currency")),
          externalFine:
            locked && room
              ? room.externalFine
              : String(form.get("externalFine")),
          pointLevels: levels,
        };
        startTransition(async () => {
          const result = room
            ? await updateRoom(room.id, data)
            : await createRoom(data);
          if (!result.ok) setError(result.error);
          else if (!room && result.data) {
            router.push(`/rooms/${result.data.id}/waiting`);
          } else {
            setSaved(true);
          }
        });
      }}
    >
      <div className="space-y-5">
        <div className="eyebrow">Room details</div>
        <Field label="Room name" htmlFor="title">
          <Input
            id="title"
            name="title"
            placeholder="e.g. The daily build"
            defaultValue={room?.title}
            required
            minLength={2}
            maxLength={120}
          />
        </Field>
        <Field label="A note for your people" htmlFor="note">
          <Textarea
            id="note"
            name="note"
            placeholder="Describe the challenge and expectations."
            defaultValue={room?.note}
            maxLength={2000}
          />
        </Field>
        <Field label="Who can find this room?" htmlFor="visibility">
          <select
            id="visibility"
            name="visibility"
            className="select-input"
            defaultValue={room?.visibility || "private"}
          >
            <option value="private">
              Invite only — join with a link or code
            </option>
            <option value="public">Public — anyone can find and join</option>
          </select>
        </Field>
      </div>
      <div className="space-y-5 border-t pt-6">
        <div className="eyebrow">Schedule</div>
        {locked ? (
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Members have set their goals. Commitment dates, points, and fines
            are now fixed.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" htmlFor="startDate">
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={room?.startDate || todayIn()}
              disabled={locked}
            />
          </Field>
          <Field label="End date" htmlFor="endDate">
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required={!infinite}
              defaultValue={room?.endDate || ""}
              disabled={infinite || locked}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={infinite}
            onChange={(e) => setInfinite(e.target.checked)}
            disabled={locked}
            className="accent-[#60806b]"
          />
          No end date
        </label>
        <Field
          label="Room timezone"
          htmlFor="timezone"
          hint="Everyone checks in against the same day. The day ends at midnight in this timezone."
        >
          <Input
            id="timezone"
            name="timezone"
            defaultValue={
              room?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            required
            disabled={locked}
          />
        </Field>
      </div>
      <div className="space-y-4 border-t pt-6">
        <div className="eyebrow">Point levels</div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          One check-in a day, with proof. Members choose the level they
          achieved; points are awarded immediately.
        </p>
        {levels.map((level, i) => (
          <div
            className="rounded-lg border bg-background p-3"
            // biome-ignore lint/suspicious/noArrayIndexKey: Proof levels have fixed positions and are never reordered.
            key={`level-${i + 1}`}
          >
            <div className="mb-3 flex gap-3">
              <Input
                aria-label={`Level ${i + 1} name`}
                value={level.name}
                disabled={locked}
                required
                maxLength={120}
                onChange={(e) =>
                  setLevels(
                    levels.map((l, j) =>
                      j === i ? { ...l, name: e.target.value } : l,
                    ),
                  )
                }
              />
              <div className="flex w-24 shrink-0 items-center gap-2">
                <Input
                  aria-label={`Level ${i + 1} points`}
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={level.points}
                  disabled={locked}
                  onChange={(e) =>
                    setLevels(
                      levels.map((l, j) =>
                        j === i ? { ...l, points: Number(e.target.value) } : l,
                      ),
                    )
                  }
                />
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
            </div>
            <Input
              aria-label={`Level ${i + 1} proof requirement`}
              value={level.requirement}
              disabled={locked}
              minLength={5}
              maxLength={500}
              required
              onChange={(e) =>
                setLevels(
                  levels.map((l, j) =>
                    j === i ? { ...l, requirement: e.target.value } : l,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="space-y-5 border-t pt-6">
        <div className="eyebrow">Fines</div>
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <Field
            label="Fine per missed day"
            htmlFor="missedDayFine"
            hint="Optional. Set to 0 for a room without money fines."
          >
            <Input
              id="missedDayFine"
              name="missedDayFine"
              type="number"
              min={0}
              max={100000000}
              step="0.01"
              defaultValue={room ? room.missedDayFine / 100 : 0}
              required
              disabled={locked}
            />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <select
              id="currency"
              name="currency"
              className="select-input"
              defaultValue={room?.currency || "IDR"}
              disabled={locked}
            >
              <option>IDR</option>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </Field>
        </div>
        <Field
          label="External consequence"
          htmlFor="externalFine"
          hint="A shared agreement your group handles outside the app."
        >
          <Textarea
            id="externalFine"
            name="externalFine"
            placeholder="e.g. Miss 3 days? Buy the crew a coffee."
            defaultValue={room?.externalFine}
            maxLength={1000}
            disabled={locked}
          />
        </Field>
      </div>
      <FormError error={error} />
      {saved ? (
        <p role="status" className="text-xs text-success">
          Room updated.
        </p>
      ) : null}
      <div className="flex justify-end border-t pt-5">
        <Button type="submit" disabled={pending}>
          {room ? "Save room" : "Create room"}
          <Busy pending={pending} />
        </Button>
      </div>
    </form>
  );
}

export function GoalDialog({
  room,
  goal,
  today,
  trigger,
}: {
  room: Room;
  goal: Goal | null;
  today: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [infinite, setInfinite] = useState(
    goal ? !goal.endDate : !room.endDate,
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus />
            {goal ? "Edit your goal" : "Set your goal"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-6 text-sm font-medium">
          {goal ? "Edit your goal" : "Set your goal"}
        </DialogTitle>
        <DialogDescription className="mb-6 mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Define your project, daily goal, and optional milestones.
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            const data = {
              topic: String(form.get("topic")),
              project: String(form.get("project")),
              dailyGoal: String(form.get("dailyGoal")),
              weeklyGoal: String(form.get("weeklyGoal")),
              monthlyGoal: String(form.get("monthlyGoal")),
              startDate: goal?.startDate || String(form.get("startDate")),
              endDate: goal
                ? goal.endDate || ""
                : infinite
                  ? ""
                  : String(form.get("endDate")),
            };
            startTransition(async () => {
              const result = await saveGoal(room.id, data);
              if (result.ok) {
                setOpen(false);
              } else setError(result.error);
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Topic" htmlFor="topic">
              <Input
                id="topic"
                name="topic"
                placeholder="Design, fitness, learning…"
                defaultValue={goal?.topic}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>
            <Field label="Project" htmlFor="project">
              <Input
                id="project"
                name="project"
                placeholder="The thing you're building"
                defaultValue={goal?.project}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>
          </div>
          <Field
            label="Daily goal"
            htmlFor="dailyGoal"
            hint="One clear action you can prove every day."
          >
            <Textarea
              id="dailyGoal"
              name="dailyGoal"
              placeholder="e.g. Spend 45 focused minutes building my app."
              defaultValue={goal?.dailyGoal}
              required
              minLength={5}
              maxLength={500}
              className="min-h-16"
            />
          </Field>
          <Field label="Weekly milestone · optional" htmlFor="weeklyGoal">
            <Input
              id="weeklyGoal"
              name="weeklyGoal"
              placeholder="e.g. Ship one complete feature."
              defaultValue={goal?.weeklyGoal}
              maxLength={500}
            />
          </Field>
          <Field label="Monthly milestone · optional" htmlFor="monthlyGoal">
            <Input
              id="monthlyGoal"
              name="monthlyGoal"
              placeholder="e.g. Launch to my first 10 users."
              defaultValue={goal?.monthlyGoal}
              maxLength={500}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="goalStart">
              <Input
                id="goalStart"
                name="startDate"
                type="date"
                defaultValue={
                  goal?.startDate ||
                  (room.startDate > today ? room.startDate : today)
                }
                min={room.startDate > today ? room.startDate : today}
                max={room.endDate || undefined}
                required
                disabled={Boolean(goal)}
              />
            </Field>
            <Field label="End date" htmlFor="goalEnd">
              <Input
                id="goalEnd"
                name="endDate"
                type="date"
                defaultValue={goal?.endDate || room.endDate || ""}
                min={room.startDate}
                max={room.endDate || undefined}
                required={!infinite}
                disabled={infinite || Boolean(goal)}
              />
            </Field>
          </div>
          {!room.endDate ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={infinite}
                onChange={(e) => setInfinite(e.target.checked)}
                disabled={Boolean(goal)}
              />
              No end date
            </label>
          ) : null}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Your dates are fixed after saving. Missed-day fines start on your
            chosen date.
          </p>
          <FormError error={error} />
          <Button className="w-full" type="submit" disabled={pending}>
            Save goal
            <Busy pending={pending} />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CheckinDialog({
  room,
  storageAvailable,
  disabled = false,
  trigger,
}: {
  room: Room;
  storageAvailable: boolean;
  disabled?: boolean;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  async function upload(proof: File) {
    setError("");
    setUploading(true);
    try {
      if (proof.size > MAX_PROOF_SIZE)
        throw new Error("Proof files must be 500 KB or smaller.");
      if (!proof.size || !PROOF_TYPES.includes(proof.type))
        throw new Error("Use a JPG, PNG, WebP, PDF, or MP4 file.");
      const form = new FormData();
      form.append("roomId", room.id);
      form.append("file", proof);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button disabled={disabled}>
            <Plus />
            Check in today
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-6 text-sm font-medium">
          Daily check-in
        </DialogTitle>
        <DialogDescription className="mb-6 mt-1.5 text-xs text-muted-foreground">
          Choose a point level and attach proof of your progress.
        </DialogDescription>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            const data = {
              title: String(form.get("title")),
              body: String(form.get("body")),
              proofUrl: String(form.get("proofUrl")),
              attachmentId: file?.id || "",
              level,
            };
            startTransition(async () => {
              const result = await submitCheckin(room.id, data);
              if (!result.ok) setError(result.error);
              else {
                setOpen(false);
                setFile(null);
              }
            });
          }}
        >
          <Field label="What did you get done?" htmlFor="checkTitle">
            <Input
              id="checkTitle"
              name="title"
              placeholder="Give today's progress a title"
              required
              minLength={3}
              maxLength={120}
            />
          </Field>
          <Field label="The story · optional" htmlFor="checkBody">
            <Textarea
              id="checkBody"
              name="body"
              placeholder="What went well? What did you learn?"
              maxLength={3000}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="field-label">Your proof level</legend>
            {room.pointLevels.map((item, i) => (
              <label
                key={item.name}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 ${level === i ? "border-ring bg-muted/50" : "border-input"}`}
              >
                <input
                  type="radio"
                  name="level"
                  className="mt-0.5"
                  checked={level === i}
                  onChange={() => setLevel(i)}
                />
                <span className="flex-1">
                  <span className="block text-xs font-medium">{item.name}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                    {item.requirement}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  +{item.points}
                </span>
              </label>
            ))}
          </fieldset>
          <Field
            label="Proof link"
            htmlFor="proofUrl"
            hint="A commit, screenshot, document, activity, or anything that shows your work."
          >
            <Input
              id="proofUrl"
              name="proofUrl"
              type="url"
              placeholder="https://…"
              required={!file}
              maxLength={2000}
            />
          </Field>
          {storageAvailable ? (
            <div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                <Upload className="size-3.5" />
                {uploading
                  ? "Uploading…"
                  : file
                    ? file.name
                    : "Or upload proof · up to 500 KB"}
                <input
                  type="file"
                  aria-label="Upload proof"
                  className="sr-only"
                  accept={PROOF_TYPES.join(",")}
                  disabled={uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          ) : null}
          <FormError error={error} />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || uploading}
          >
            Submit proof · +{room.pointLevels[level].points} points
            <Busy pending={pending} />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InviteDialog({ code }: { code: string }) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  async function copy(kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(
        kind === "code" ? code : `${window.location.origin}/join/${code}`,
      );
      setCopied(kind);
    } catch {
      setError(
        "Copy isn't available in this browser. Select and copy the code below.",
      );
    }
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus />
          Invite people
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-6 text-sm font-medium">
          Invite people
        </DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-xs text-muted-foreground">
          Share this code or invitation link to bring someone into your room.
        </DialogDescription>
        <div className="mb-4 rounded-lg border bg-background p-5 text-center">
          <p className="eyebrow mb-3">Room invite code</p>
          <p className="select-all font-mono text-2xl tracking-[.18em]">
            {code}
          </p>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => copy("link")}>
            {copied === "link" ? <Check /> : <Link2 />}
            {copied === "link" ? "Link copied" : "Copy invite link"}
          </Button>
          <Button variant="outline" onClick={() => copy("code")}>
            {copied === "code" ? <Check /> : <Copy />}
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
        </div>
        <FormError error={error} />
      </DialogContent>
    </Dialog>
  );
}

export function CommentForm({ checkinId }: { checkinId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const result = await addComment(checkinId, body);
          if (result.ok) {
            setBody("");
          } else setError(result.error);
        });
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label="Comment"
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={1000}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={pending || !body.trim()}
        >
          <Busy pending={pending} />
          <span className="sr-only">Send comment</span>
        </Button>
      </div>
      <FormError error={error} />
    </form>
  );
}
