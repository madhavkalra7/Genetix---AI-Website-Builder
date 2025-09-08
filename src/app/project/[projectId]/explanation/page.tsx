"use client";
const logoSrc = "/logo.png";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ProjectExplanationPage() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : Array.isArray(params.projectId) ? params.projectId[0] : "";
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullResponse, setFullResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  function fetchExplanation() {
    setLoading(true);
    setError(null);
    setFullResponse(null);
    setExplanation(null);
    const local = localStorage.getItem(`genetix_explanation_${projectId}`);
    if (local) {
      setExplanation(local);
      setLoading(false);
    } else {
      setError("No explanation found in localStorage. Please try again from the project page.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    fetchExplanation();
  }, [projectId]);

  // Helper to parse explanation and render code blocks and explanations
  function renderExplanation(text: string) {
    // Split by file headings (## or ###)
    const fileSections = text.split(/(?:^|\n)##+\s+/).filter(Boolean);
    return fileSections.map((section, idx) => {
      // Extract file name (first line)
      const lines = section.split("\n");
      const fileName = lines[0]?.replace(/[`*]/g, "").trim() || `File ${idx+1}`;
      // Extract code block
      const codeMatch = section.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : null;
      // Extract explanation (remove code block and filename)
      let explanationText = section.replace(lines[0], "").replace(/```[\s\S]*?```/, "").replace(/\*\*|\*/g, "").replace(/^- /gm, "").replace(/\n{2,}/g, "\n").trim();
      return (
        <div key={idx} className="mb-8">
          <div className="text-lg font-semibold text-orange-300 mb-2">{fileName}</div>
          {code && (
            <pre className="bg-zinc-900 text-green-300 rounded-lg p-4 mb-2 overflow-x-auto text-xs border border-zinc-700">
              <code>{code}</code>
            </pre>
          )}
          <div className="text-base text-zinc-200 whitespace-pre-line">{explanationText}</div>
        </div>
      );
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
      <img src={logoSrc} alt="Genetix Logo" className="h-16 mb-6" />
      <h1 className="text-3xl font-bold mb-2 text-orange-400">Genetix Project Explanation</h1>
      <p className="mb-8 text-lg text-zinc-400">AI-powered explanation of your project codebase</p>
      <div className="max-w-3xl w-full bg-zinc-950 rounded-xl shadow-lg p-6 border border-zinc-800">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-orange-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <span className="text-orange-400">Generating explanation...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center">
            <div className="text-red-400 font-bold mb-2">Error: {error}</div>
            {fullResponse && (
              <pre className="bg-zinc-900 text-red-300 rounded-lg p-4 mb-2 overflow-x-auto text-xs border border-zinc-700">
                {JSON.stringify(fullResponse, null, 2)}
              </pre>
            )}
            <button
              className="mt-4 px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              onClick={fetchExplanation}
            >
              Try Again
            </button>
          </div>
        ) : explanation ? renderExplanation(explanation) : <div>Loading...</div>}
      </div>
    </div>
  );
}