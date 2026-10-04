import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@/components/sign-in";
import { demoEnabled, googleConfigured } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/redirect";
import { getViewer } from "@/lib/session";

export const metadata = { title: "Sign in" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const next = safeRedirectPath(query.next);
  if (await getViewer()) redirect(next);
  return (
    <main className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-6 py-12">
      <div className="panel w-full max-w-sm p-6">
        <h1 className="mb-2 text-lg font-medium">Sign in</h1>
        <p className="mb-6 text-xs/relaxed text-muted-foreground">
          Sign in to create rooms and save your progress.
        </p>
        <SignIn
          googleAvailable={googleConfigured}
          demoAvailable={demoEnabled}
          next={next}
        />
        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back home
        </Link>
      </div>
    </main>
  );
}
