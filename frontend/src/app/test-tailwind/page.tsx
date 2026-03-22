export default function TestTailwind() {
  return (
    <div className="min-h-screen bg-blue-500 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Tailwind Test</h1>
        <p className="text-gray-600">If you see this styled box, Tailwind is working!</p>
        <button className="mt-4 bg-[#0B3C8A] text-white px-4 py-2 rounded-lg hover:bg-[#082F6E]">
          Test Button
        </button>
      </div>
    </div>
  );
}
