import { Link } from "react-router-dom";
import PageLayout, { sectionCardClass } from "../components/PageLayout";
export default function App() {
  return (
    <PageLayout title="Welcome" description="Track the people who matter and keep your follow-ups intentional.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className={sectionCardClass}>
          <h2 className="text-[22px] font-semibold text-[#1A1A1A]">Get started</h2>
          <p className="mt-3 text-base text-[#6B7280]">
            Head to the people list to add someone, log interactions, and keep tabs on your next touchpoint.
          </p>
          <Link
            to="/people"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-[#3A6FF8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#315cce]"
          >
            Go to People
          </Link>
        </div>
        <div className={sectionCardClass}>
          <h2 className="text-[22px] font-semibold text-[#1A1A1A]">Weekly review</h2>
          <p className="mt-3 text-base text-[#6B7280]">
            Quickly scan the five relationships that need attention next based on recency, importance, and open loops.
          </p>
          <Link
            to="/review"
            className="mt-6 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition hover:border-[#3A6FF8] hover:text-[#3A6FF8]"
          >
            View Review
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
