import { Skeleton } from "./Skeleton";

/* Layout-matching skeletons. These mirror the real page scaffolding
 * (page-header, filter bar, table-card, stat-grid, opp-grid) so a loading
 * screen keeps the same shape as the content that replaces it. */

export function PageHeaderSkeleton({ toolbar = true }: { toolbar?: boolean }) {
  return (
    <div className="page-header">
      <div className="flex flex-col gap-2">
        <Skeleton w={260} h={22} />
        <Skeleton w={420} h={13} style={{ maxWidth: "80vw" }} />
      </div>
      {toolbar && (
        <div className="page-toolbar">
          <Skeleton w={150} h={32} style={{ borderRadius: 6 }} />
        </div>
      )}
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <Skeleton w={240} h={34} style={{ borderRadius: 8 }} />
        <Skeleton w={180} h={34} style={{ borderRadius: 8 }} />
      </div>
      <Skeleton w={150} h={12} />
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="table-card">
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, c) => (
                <th key={c}>
                  <Skeleton w={c === 0 ? 140 : 90} h={11} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c}>
                    {c === 0 ? (
                      <span className="flex flex-col gap-1.5">
                        <Skeleton w={150} h={13} />
                        <Skeleton w={100} h={10} />
                      </span>
                    ) : c === columns - 1 ? (
                      <span className="inline-flex gap-1.5 justify-end w-full">
                        <Skeleton w={64} h={24} style={{ borderRadius: 4 }} />
                        <Skeleton w={64} h={24} style={{ borderRadius: 4 }} />
                      </span>
                    ) : (
                      <Skeleton w={`${55 + ((r + c) % 3) * 12}%`} h={13} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** page-header + filter bar + table — the shape of Applications / Hours /
 *  Volunteers / Team tables. */
export function ListPageSkeleton({
  columns = 5,
  rows = 6,
  filterBar = true,
}: {
  columns?: number;
  rows?: number;
  filterBar?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {filterBar && <FilterBarSkeleton />}
      <TableSkeleton rows={rows} columns={columns} />
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  header = true,
}: {
  count?: number;
  header?: boolean;
}) {
  return (
    <div className="space-y-6">
      {header && <PageHeaderSkeleton />}
      <div className="opp-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="opp-card">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <Skeleton w={70} h={18} style={{ borderRadius: 999 }} />
                <Skeleton w={54} h={18} style={{ borderRadius: 999 }} />
              </div>
              <Skeleton w="80%" h={18} />
              <Skeleton w="55%" h={12} />
              <Skeleton w="100%" h={11} />
              <Skeleton w="70%" h={11} />
            </div>
            <div className="opp-footer">
              <Skeleton w={90} h={12} />
              <Skeleton w={110} h={26} style={{ borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-4 flex flex-col gap-2.5">
          <Skeleton w={110} h={10} />
          <Skeleton w={90} h={22} />
          <Skeleton w={160} h={10} />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatGridSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="panel p-5 flex flex-col gap-3">
            <Skeleton w={180} h={14} />
            {Array.from({ length: 5 }).map((_, r) => (
              <div key={r} className="flex items-center justify-between gap-3">
                <Skeleton w="55%" h={12} />
                <Skeleton w={60} h={12} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton toolbar={false} />
      <div className="panel p-5 flex flex-col gap-5" style={{ maxWidth: 640 }}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton w={120} h={11} />
            <Skeleton w="100%" h={38} style={{ borderRadius: 8 }} />
          </div>
        ))}
        <div className="flex justify-end">
          <Skeleton w={120} h={34} style={{ borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <Skeleton w={220} h={22} />
        <Skeleton w={300} h={12} />
        <Skeleton w={260} h={12} />
      </div>
      {[0, 1, 2].map((s) => (
        <div key={s} className="flex flex-col gap-2.5">
          <Skeleton w={140} h={16} />
          {Array.from({ length: 3 }).map((_, r) => (
            <Skeleton key={r} w="100%" h={44} style={{ borderRadius: 8 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Generic full-page skeleton the AppShell shows in <main> while the account
 *  is still loading — page header + filter bar + table. */
export function ShellContentSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your account…</span>
      <ListPageSkeleton columns={5} rows={6} />
    </div>
  );
}
