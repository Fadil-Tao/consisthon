import { eq } from "drizzle-orm";
import { addDays, DEFAULT_LEVELS, todayIn } from "../lib/domain";
import { db } from "./index";
import { checkins, comments, goals, members, rooms, user } from "./schema";

export async function seedDemo() {
  const today = todayIn();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.id, "the-daily-build"));
    if (existing) return;
    const people = [
      {
        id: "demo-you",
        name: "Alex Morgan",
        email: "alex@example.invalid",
        topic: "Development",
        project: "My first SaaS",
        dailyGoal:
          "Spend 45 focused minutes building and ship one small improvement.",
        weeklyGoal: "Ship one complete feature every week.",
        monthlyGoal: "Launch a working MVP with 10 early users.",
        threshold: 2,
        streak: 7,
      },
      {
        id: "demo-jules",
        name: "Jules Chen",
        email: "jules@example.invalid",
        topic: "Design",
        project: "A little design studio",
        dailyGoal:
          "Create one component and share a screenshot of the process.",
        weeklyGoal: "Publish one case study.",
        monthlyGoal: "Finish my portfolio.",
        threshold: 1,
        streak: 12,
      },
      {
        id: "demo-sam",
        name: "Sam Rivera",
        email: "sam@example.invalid",
        topic: "Writing",
        project: "Notes from the journey",
        dailyGoal: "Write 300 words before opening social media.",
        weeklyGoal: "Publish a newsletter.",
        monthlyGoal: "Write four long-form essays.",
        threshold: 3,
        streak: 4,
      },
      {
        id: "demo-nora",
        name: "Nora Park",
        email: "nora@example.invalid",
        topic: "Learning",
        project: "Learning Japanese",
        dailyGoal: "Study for 30 minutes and complete 20 flashcards.",
        weeklyGoal: "Finish two lessons.",
        monthlyGoal: "Read my first short story.",
        threshold: 4,
        streak: 3,
      },
    ];
    for (const person of people)
      await tx
        .insert(user)
        .values({
          id: person.id,
          name: person.name,
          email: person.email,
          emailVerified: true,
        })
        .onConflictDoNothing();
    await tx.insert(rooms).values({
      id: "the-daily-build",
      title: "The daily build",
      note: "A little progress, every single day. A room for makers, learners, and anyone turning a someday project into something real. Show your work. Cheer each other on.",
      masterId: "demo-you",
      inviteCode: "BUILD2026",
      visibility: "public",
      startDate: addDays(today, -49),
      endDate: addDays(today, 40),
      timezone: "Asia/Makassar",
      pointLevels: DEFAULT_LEVELS,
      missedDayFine: 1000000,
      currency: "IDR",
      externalFine:
        "Miss 3 days in a week? Buy the crew a coffee at the next meetup.",
    });
    for (const [index, person] of people.entries()) {
      await tx.insert(members).values({
        id: `member-${person.id}`,
        userId: person.id,
        roomId: "the-daily-build",
        joinedDate: addDays(today, -49),
      });
      await tx.insert(goals).values({
        id: `goal-${person.id}`,
        roomId: "the-daily-build",
        userId: person.id,
        topic: person.topic,
        project: person.project,
        dailyGoal: person.dailyGoal,
        weeklyGoal: person.weeklyGoal,
        monthlyGoal: person.monthlyGoal,
        startDate: addDays(today, -49),
        endDate: addDays(today, 40),
      });
      for (let day = 49; day >= 0; day--) {
        if (day === 0 && index === 0) continue;
        if (
          day >= person.streak &&
          (day === person.streak ||
            (day + index) % (person.threshold + 3) === 0)
        )
          continue;
        const date = addDays(today, -day);
        const level =
          (day + index) % 8 === 0 ? 2 : (day + index) % 3 === 0 ? 0 : 1;
        await tx.insert(checkins).values({
          id: `proof-${person.id}-${date}`,
          roomId: "the-daily-build",
          userId: person.id,
          date,
          title:
            index === 0
              ? "One small step closer to launch"
              : index === 1
                ? "Made time for the craft"
                : index === 2
                  ? "Words on the page"
                  : "Another lesson in the books",
          body:
            index === 1
              ? "Refined the navigation and spacing today. Small details add up. Feeling good about the direction!"
              : "Kept my promise to myself today. Focused on the daily goal and made a little more progress.",
          proofUrl: "https://github.com",
          level,
          points: DEFAULT_LEVELS[level].points,
          createdAt: new Date(
            `${date}T${String(8 + index).padStart(2, "0")}:00:00Z`,
          ),
        });
      }
    }
    await tx.insert(comments).values({
      id: "demo-comment",
      checkinId: `proof-demo-jules-${today}`,
      userId: "demo-sam",
      body: "Love this. The little details make all the difference 🙌",
    });
    await tx.insert(rooms).values({
      id: "morning-momentum",
      title: "Morning momentum",
      note: "Start the day with something that matters. Read, move, learn, or make — before the world gets loud.",
      masterId: "demo-jules",
      inviteCode: "RISE2026",
      visibility: "public",
      startDate: addDays(today, 3),
      endDate: null,
      timezone: "Asia/Makassar",
      pointLevels: DEFAULT_LEVELS,
      missedDayFine: 0,
      currency: "IDR",
      externalFine: "Share one thing you learned with the group each Sunday.",
    });
    await tx.insert(members).values({
      id: "morning-jules",
      userId: "demo-jules",
      roomId: "morning-momentum",
      joinedDate: today,
    });
  });
}
