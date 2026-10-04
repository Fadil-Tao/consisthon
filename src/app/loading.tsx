export default function Loading() {
  return (
    <main
      aria-label="Loading room"
      className="mx-auto max-w-[1120px] animate-pulse px-6 py-12"
    >
      <div className="mb-5 h-5 w-28 rounded bg-muted" />
      <div className="mb-8 h-10 w-72 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </main>
  );
}
