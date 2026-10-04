"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { startDemo } from "@/app/actions";
import { authClient } from "@/lib/auth-client";
import { FormError } from "./forms";
import { Button } from "./ui/button";

export function SignIn({
  googleAvailable,
  demoAvailable,
  next,
}: {
  googleAvailable: boolean;
  demoAvailable: boolean;
  next: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {googleAvailable ? (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                const result = await authClient.signIn.social({
                  provider: "google",
                  callbackURL: next,
                });
                if (result.error)
                  setError(
                    result.error.message || "Couldn't sign in with Google.",
                  );
              } catch {
                setError("Couldn't reach Google. Please try again.");
              }
            });
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <path
              fill="currentColor"
              d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.7ZM12 22c2.7 0 5-1 6.8-2.6l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.7A10 10 0 0 0 12 22ZM6.2 13.5a6 6 0 0 1 0-3.8V7H2.8a10 10 0 0 0 0 9.2l3.4-2.7ZM12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.4 9.4 0 0 0 12 2a10 10 0 0 0-9.2 5l3.4 2.7c.8-2.5 3.1-4.3 5.8-4.3Z"
            />
          </svg>
          Continue with Google
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ArrowRight className="ml-auto" />
          )}
        </Button>
      ) : null}
      {demoAvailable ? (
        <>
          {googleAvailable ? (
            <div className="flex items-center gap-3 py-2 text-[9px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
          <Button
            variant={googleAvailable ? "outline" : "default"}
            className="w-full"
            disabled={pending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                const result = await startDemo(next);
                if (result?.ok === false) setError(result.error);
              });
            }}
          >
            Continue
            {pending ? (
              <Loader2 className="ml-auto animate-spin" />
            ) : (
              <ArrowRight className="ml-auto" />
            )}
          </Button>
        </>
      ) : null}
      {!googleAvailable && !demoAvailable ? (
        <p className="text-xs text-muted-foreground">
          Sign-in is currently unavailable. Please try again later.
        </p>
      ) : null}
      <FormError error={error} />
    </div>
  );
}
