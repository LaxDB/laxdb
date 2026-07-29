"use client";

import { Logo } from "@laxdb/ui/components/logo";
import { Link } from "@tanstack/react-router";

import { siteConfig } from "@/site";

export function NavBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4 py-3">
        <Link
          aria-label="Home"
          className="flex w-fit items-center gap-2 text-lg font-medium text-foreground"
          to={siteConfig.baseLinks.home}
        >
          <Logo />
          LaxDB
        </Link>
      </div>
    </header>
  );
}
