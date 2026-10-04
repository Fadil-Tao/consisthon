import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Choose a valid date.",
  );
const endDate = z.union([date, z.literal("")]).transform((s) => s || null);
const shortText = z.string().trim().min(2).max(120);
export const roomInput = z
  .object({
    title: shortText,
    note: z.string().trim().max(2000),
    startDate: date,
    endDate,
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone."),
    visibility: z.enum(["public", "private"]),
    currency: z.enum(["IDR", "USD", "EUR", "GBP"]),
    missedDayFine: z.coerce
      .number()
      .min(0)
      .max(100_000_000)
      .transform((n) => Math.round(n * 100)),
    externalFine: z.string().trim().max(1000),
    pointLevels: z
      .array(
        z.object({
          name: shortText,
          points: z.coerce.number().int().min(1).max(1000),
          requirement: z.string().trim().min(5).max(500),
        }),
      )
      .min(1)
      .max(5),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export const goalInput = z
  .object({
    topic: shortText,
    project: shortText,
    dailyGoal: z.string().trim().min(5).max(500),
    weeklyGoal: z.string().trim().max(500),
    monthlyGoal: z.string().trim().max(500),
    startDate: date,
    endDate,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export const checkinInput = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().max(3000),
    proofUrl: z.union([
      z
        .url()
        .max(2000)
        .refine(
          (s) => /^https?:\/\//i.test(s),
          "Use an http or https proof link.",
        ),
      z.literal(""),
    ]),
    attachmentId: z.string().max(100),
    level: z.coerce.number().int().min(0).max(4),
  })
  .refine((v) => v.proofUrl || v.attachmentId, {
    message: "Add a proof link or upload a file to check in.",
    path: ["proofUrl"],
  });

export type RoomInput = z.input<typeof roomInput>;
export type GoalInput = z.input<typeof goalInput>;
export type CheckinInput = z.input<typeof checkinInput>;
