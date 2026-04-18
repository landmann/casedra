"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@casablanca/ui";

import { DEFAULT_SLUG, DOCS } from "./docs";

export function MasterPlanTabs() {
  const segment = useSelectedLayoutSegment();
  const activeSlug = segment ?? DEFAULT_SLUG;

  return (
    <nav
      aria-label="Masterplan sections"
      className="mt-6 flex flex-wrap gap-2 pb-3"
    >
      {DOCS.map((doc) => {
        const isActive = doc.slug === activeSlug;
        return (
          <Link
            key={doc.slug}
            href={`/masterplan/${doc.slug}`}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {doc.label}
          </Link>
        );
      })}
    </nav>
  );
}
