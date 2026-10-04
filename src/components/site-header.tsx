"use client";

import { ArrowUpRight, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { endDemo } from "@/app/actions";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-base font-semibold tracking-[-0.7px]"
      aria-label="Consisthon home"
    >
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      consisthon
    </Link>
  );
}
export function SiteHeader({
  viewer,
}: {
  viewer: { name: string; demo: boolean } | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  return (
    <header className="relative z-20 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
          </Button>
          {viewer ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {viewer.name.split(" ")[0]}
              </span>
              <Avatar name={viewer.name} className="size-7" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (viewer.demo) {
                      await endDemo();
                      return;
                    }
                    await authClient.signOut();
                    window.location.assign("/");
                  })
                }
              >
                <LogOut />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/sign-in">
                Sign in <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
