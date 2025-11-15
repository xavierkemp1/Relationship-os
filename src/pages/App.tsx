
export default function App() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Relationship OS (MVP)</h1>
      <nav className="flex gap-3">
        <a className="px-3 py-2 rounded bg-gray-100" href="/people">People</a>
        <a className="px-3 py-2 rounded bg-gray-100" href="/review">Weekly Review</a>
      </nav>
      <p className="mt-6 text-gray-600">
        Add someone you care about, then log a quick voice note after you chat.
      </p>
    </div>
  );
}
