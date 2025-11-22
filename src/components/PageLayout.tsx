import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

type BackLink = {
  to: string;
  label: string;
};

type PageLayoutProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backLink?: BackLink;
  children: ReactNode;
};

// Cards: white on light gray background
export const sectionCardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6";

// Inputs: shadcn-style focus, but using slate palette
export const inputBaseClass =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const labelClass = "text-sm font-medium text-slate-800";
export const sectionTitleClass =
  "text-sm font-semibold tracking-tight text-slate-900";

export default function PageLayout({
  title,
  description,
  actions,
  backLink,
  children,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* App header */}
      <header className="border-b border-slate-800 bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Relationship OS
            </h1>
            <p className="text-xs text-slate-400">
              Intentional follow-ups with the people who matter.
            </p>
          </div>
          {actions && (
            <div className="hidden items-center gap-2 md:flex">{actions}</div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto flex max-w-5xl flex-1 flex-col px-4 py-4 md:py-6">
        <div className="mb-4 flex items-start justify-between gap-4 md:mb-6">
          <div className="space-y-2">
            {backLink && (
              <Link
                to={backLink.to}
                className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <span className="mr-1">←</span>
                {backLink.label}
              </Link>
            )}
            <div>
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 md:hidden">{actions}</div>
          )}
        </div>

        <Separator className="mb-4 md:mb-6" />

        <div className="flex-1 space-y-4 md:space-y-6">{children}</div>
      </main>
    </div>
  );
}
