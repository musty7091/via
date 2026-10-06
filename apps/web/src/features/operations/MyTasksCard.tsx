import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { useMyTasks } from "@/features/operations/api";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/format";
import { TASK_CATEGORY_LABELS } from "@/shared/lib/labels";
import { Badge, Card, CardHeader } from "@/shared/ui";

/** Giriş yapan kullanıcıya atanmış açık görevler. Görev yoksa hiç görünmez. */
export function MyTasksCard({ className }: { className?: string }) {
  const tasks = useMyTasks();
  const items = tasks.data ?? [];
  if (items.length === 0) return null;
  const overdue = items.filter((t) => t.task.is_overdue).length;

  return (
    <Card className={className}>
      <CardHeader
        title="Bana Atanan Görevler"
        description={`${items.length} açık görev${overdue ? ` · ${overdue} gecikmiş` : ""}`}
      />
      <ul className="divide-y divide-line">
        {items.slice(0, 8).map(({ task, event_id, event_title, event_date }) => (
          <li key={task.id}>
            <Link
              to={`/etkinlikler/${event_id}?sekme=operasyon`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{task.title}</p>
                <p className="truncate text-xs text-ink-muted">
                  {event_title} · {formatDate(event_date, "short")}
                </p>
              </div>
              <Badge dot={false} className="hidden sm:inline-flex">
                {TASK_CATEGORY_LABELS[task.category]}
              </Badge>
              {task.due_date && (
                <span className={cn("text-xs whitespace-nowrap", task.is_overdue ? "font-medium text-danger-700" : "text-ink-muted")}>
                  {task.is_overdue ? "Gecikti" : formatDate(task.due_date, "short")}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
