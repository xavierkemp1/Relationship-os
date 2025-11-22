import { Link } from "react-router-dom";
import PageLayout, { sectionCardClass } from "../components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function App() {
  return (
    <PageLayout
      title="Welcome poopy"
      description="Track the people who matter and keep your follow-ups intentional."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={sectionCardClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-[22px] font-semibold text-foreground">
              Get started
            </CardTitle>
            <CardDescription className="mt-1 text-base text-muted-foreground">
              Head to the people list to add someone, log interactions, and keep
              tabs on your next touchpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="mt-2">
              <Link to="/people">Go to People</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-[22px] font-semibold text-foreground">
              Weekly review
            </CardTitle>
            <CardDescription className="mt-1 text-base text-muted-foreground">
              Quickly scan the five relationships that need attention next based
              on recency, importance, and open loops.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="mt-2 border-muted-foreground/20"
            >
              <Link to="/review">View Review</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

