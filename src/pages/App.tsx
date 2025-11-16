
import { NavLink } from "react-router-dom";

export default function App() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Relationship OS (MVP)</h1>
      <nav className="flex gap-3">
        <NavLink className="px-3 py-2 rounded bg-gray-100" to="/people">
          People
        </NavLink>
        <NavLink className="px-3 py-2 rounded bg-gray-100" to="/review">
          Weekly Review
        </NavLink>
      </nav>
      <p className="mt-6 text-gray-600">
        Add someone you care about, then log a quick voice note after you chat.
      </p>
    </div>
  );
}
