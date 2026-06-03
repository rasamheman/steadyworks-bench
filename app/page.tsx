import Link from "next/link";
import tasks from "@/data/tasks.json";

type Task = (typeof tasks.tasks)[number];

// Map a task to a short display label shown on its homepage card.
const SCHEMATIC_TASK_IDS = new Set(["corner-bracket-v2", "bore-socket"]);
function taskTypeLabel(task: Task): string {
  if (SCHEMATIC_TASK_IDS.has(task.id)) return "2D schematic → 3D design";
  if ((task as { input_pdf?: string | null }).input_pdf) return "2D schematic → 3D design";
  return "Modifying a primitive";
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.id}/`}
      className="group block border border-neutral-200 rounded-md overflow-hidden bg-white hover:shadow-md transition-shadow no-underline"
    >
      <div className="aspect-square bg-neutral-50 relative">
        {task.models.reference ? (
          // @ts-expect-error custom element
          <model-viewer
            src={task.models.reference}
            camera-controls
            auto-rotate
            interaction-prompt="none"
            shadow-intensity="1"
            shadow-softness="0.75"
            exposure="1.15"
            tone-mapping="commerce"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
            no model
          </div>
        )}
      </div>
      <div className="p-4 border-t border-neutral-200">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
          {task.category} · {task.difficulty}
        </div>
        <div className="font-mono text-sm text-ink mb-2">{task.id}</div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
          {taskTypeLabel(task)}
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-mono font-semibold text-ink mb-3">
          3D Design Benchmark v1
        </h1>
        <p className="text-neutral-700 max-w-3xl">
          {tasks.tasks.length} CAD tasks across MCAD primitive modifications, 2D-to-3D translation,
          assembly, and architecture. Each task gives the agent a CAD-format prompt and grades the
          output against a reference design.
        </p>
      </section>
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
