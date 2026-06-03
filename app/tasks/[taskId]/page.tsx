import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import tasks from "@/data/tasks.json";

type Task = (typeof tasks.tasks)[number];

export function generateStaticParams() {
  return tasks.tasks.map((t) => ({ taskId: t.id }));
}

function ModelPanel({ src, label }: { src: string | null | undefined; label: string }) {
  return (
    <div className="border border-neutral-200 rounded-md overflow-hidden bg-white">
      <div className="aspect-square bg-neutral-50 relative">
        {src ? (
          // @ts-expect-error custom element
          <model-viewer
            src={src}
            camera-controls
            auto-rotate
            shadow-intensity="1"
            shadow-softness="0.75"
            exposure="1.15"
            tone-mapping="commerce"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-xs px-4 text-center">
            Not yet evaluated
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-neutral-200 text-[10px] uppercase tracking-wider text-neutral-600">
        {label}
      </div>
    </div>
  );
}

function metric(value: number | null | undefined, unit = "", decimals = 0) {
  if (value === null || value === undefined) return "—";
  if (decimals > 0) return `${value.toFixed(decimals)}${unit}`;
  return `${value}${unit}`;
}

function ComparisonTable({ task }: { task: Task }) {
  const o = task.results.opus;
  const h = task.results.haiku;
  const rows: { label: string; opus: string; haiku: string }[] = [
    {
      label: "Reward",
      opus: metric(o?.reward, "", 4),
      haiku: metric(h?.reward, "", 4),
    },
    {
      label: "Tests passed",
      opus: o ? `${o.tests_passed ?? "?"}/${o.tests_total ?? "?"}` : "—",
      haiku: h ? `${h.tests_passed ?? "?"}/${h.tests_total ?? "?"}` : "—",
    },
    { label: "Duration (s)", opus: metric(o?.duration_sec, " s"), haiku: metric(h?.duration_sec, " s") },
    {
      label: "Cost (USD)",
      opus: o?.cost_usd ? `$${o.cost_usd.toFixed(4)}` : "—",
      haiku: h?.cost_usd ? `$${h.cost_usd.toFixed(4)}` : "—",
    },
    { label: "Tool calls", opus: metric(o?.tool_calls), haiku: metric(h?.tool_calls) },
    {
      label: "Tools used",
      opus: o?.tools_by_type
        ? Object.entries(o.tools_by_type).map(([k, v]) => `${k}×${v}`).join(", ")
        : "—",
      haiku: h?.tools_by_type
        ? Object.entries(h.tools_by_type).map(([k, v]) => `${k}×${v}`).join(", ")
        : "—",
    },
    {
      label: "Libraries used",
      opus: o?.libraries?.length ? o.libraries.join(", ") : "—",
      haiku: h?.libraries?.length ? h.libraries.join(", ") : "—",
    },
  ];
  return (
    <table className="w-full text-sm border border-neutral-200">
      <thead className="bg-neutral-50 text-neutral-600 text-[10px] uppercase tracking-wider">
        <tr>
          <th className="text-left px-3 py-2 font-medium">Metric</th>
          <th className="text-left px-3 py-2 font-medium">Opus 4.7</th>
          <th className="text-left px-3 py-2 font-medium">Haiku 4.5</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-neutral-200">
            <td className="px-3 py-2 text-neutral-700">{r.label}</td>
            <td className="px-3 py-2 font-mono text-ink">{r.opus}</td>
            <td className="px-3 py-2 font-mono text-ink">{r.haiku}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TaskPage({ params }: { params: { taskId: string } }) {
  const task = tasks.tasks.find((t) => t.id === params.taskId);
  if (!task) return notFound();

  return (
    <article className="space-y-10">
      <header>
        <Link href="/" className="text-xs text-neutral-500 no-underline hover:underline">← all tasks</Link>
        <h1 className="font-mono text-2xl font-semibold mt-2">{task.id}</h1>
        <div className="text-sm text-neutral-600 mt-1">
          {task.category} · {task.sub_category} · {task.task_class} · {task.difficulty}
        </div>
      </header>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Prompt</h2>
        <div className="prose prose-neutral max-w-none text-sm bg-white border border-neutral-200 rounded-md p-4">
          <ReactMarkdown>{task.prompt || "*(no prompt available)*"}</ReactMarkdown>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Models</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(task as { input_pdf?: string | null }).input_pdf ? (
            <div className="border border-neutral-200 rounded-md overflow-hidden bg-white">
              <div className="aspect-square bg-neutral-50 relative">
                <iframe
                  src={(task as { input_pdf: string }).input_pdf}
                  className="absolute inset-0 w-full h-full"
                  title={`${task.id} schematic`}
                />
              </div>
              <div className="px-3 py-2 border-t border-neutral-200 text-[10px] uppercase tracking-wider text-neutral-600">
                Input (PDF schematic)
              </div>
            </div>
          ) : (
            <ModelPanel src={task.models.input} label="Input (stock)" />
          )}
          <ModelPanel src={task.models.reference} label="Reference" />
          <ModelPanel src={task.models.opus} label="Opus 4.7 output" />
          <ModelPanel src={task.models.haiku} label="Haiku 4.5 output" />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Results — latest single trial</h2>
        <ComparisonTable task={task} />
      </section>
    </article>
  );
}
