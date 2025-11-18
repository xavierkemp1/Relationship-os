import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PageLayout, { inputBaseClass, sectionCardClass } from "../components/PageLayout";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Go back to where we came from, or /people by default
      const redirectTo =
        (location.state && (location.state.from as any)?.pathname) || "/people";
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout title="Sign in" description="Log in to your relationship OS.">
      <div className={sectionCardClass}>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBaseClass} mt-1`}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputBaseClass} mt-1`}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-[#3A6FF8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#315cce] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
