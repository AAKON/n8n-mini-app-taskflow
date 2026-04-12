"use client";

import { useParams } from "next/navigation";
import { TaskDetail } from "@/components/TaskDetail";
import { Spinner } from "@/components/ui/Spinner";

export default function TaskDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Spinner />
      </div>
    );
  }

  return <TaskDetail taskId={id} />;
}
