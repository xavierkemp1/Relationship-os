import { ReactNode } from "react";
import { Link } from "react-router-dom";

export const sectionCardClass = "bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6";
export const inputBaseClass =
  "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2.5 text-[16px] text-[#1A1A1A] transition focus:border-[#3A6FF8] focus:ring-2 focus:ring-[#3A6FF8] focus:outline-none focus:shadow-[0_0_0_2px_rgba(58,111,248,0.12)]";
export const labelClass = "text-sm font-medium text-[#555555]";
export const sectionTitleClass = "text-[18px] font-medium text-[#1A1A1A]";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  backLink?: { to: string; label: string };
}

export default function PageLayout({ children, title, description, actions, backLink }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1A1A1A] font-[system-ui]">
      <header className="bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
          <Link to="/people" className="text-[20px] font-semibold tracking-tight text-[#1A1A1A]">
            Relationship OS
          </Link>
        </div>
      </header>
      <main className="px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          {(title || description || backLink || actions) && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {backLink && (
                  <Link to={backLink.to} className="text-sm font-medium text-[#6B7280] hover:text-[#3A6FF8]">
                    ← {backLink.label}
                  </Link>
                )}
                {title && <h1 className="text-[28px] font-semibold text-[#1A1A1A]">{title}</h1>}
                {description && <p className="text-base text-[#6B7280]">{description}</p>}
              </div>
              {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
