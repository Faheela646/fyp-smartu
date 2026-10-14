import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { exportCSV, exportPDF, type Row } from "@/lib/export";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** Plain value used for sorting, searching and export. */
  value?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
  hideOnMobile?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (r: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  exportName?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Row selection (for bulk actions). */
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  /** Rows that can't be selected (e.g. already approved). */
  isSelectable?: (r: T) => boolean;
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, searchPlaceholder = "Search…", toolbar, exportName, pageSize = 10, emptyTitle = "Nothing here yet", emptyDescription, selected, onSelectedChange, isSelectable }: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number) ?? "");

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => columns.some((c) => String(val(c, r)).toLowerCase().includes(needle))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)!;
      out = [...out].sort((a, b) => {
        const x = val(col, a), y = val(col, b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  const selectable = !!onSelectedChange;
  const canSel = (r: T) => !isSelectable || isSelectable(r);
  const selectableFiltered = filtered.filter(canSel);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every((r) => selected?.has(rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) selectableFiltered.forEach((r) => next.delete(rowKey(r)));
    else selectableFiltered.forEach((r) => next.add(rowKey(r)));
    onSelectedChange?.(next);
  };
  const toggleOne = (r: T) => {
    const next = new Set(selected);
    const k = rowKey(r);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange?.(next);
  };

  const toRows = (): Row[] => filtered.map((r) => Object.fromEntries(columns.map((c) => [c.header, val(c, r)])));

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder} aria-label="Search table" className="h-12 w-full rounded-md border border-border bg-surface pl-12 pr-4 text-base placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {toolbar}
          {exportName && (
            <>
              <Button variant="outline" size="md" className="h-11 px-4 text-base font-semibold" onClick={() => exportCSV(toRows(), exportName)} disabled={!filtered.length}>
                <Download className="h-4.5 w-4.5" /> CSV
              </Button>
              <Button variant="outline" size="md" className="h-11 px-4 text-base font-semibold" onClick={() => exportPDF(toRows(), exportName, exportName.replace(/-/g, " "))} disabled={!filtered.length}>
                <FileText className="h-4.5 w-4.5" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-6"><ErrorState onRetry={onRetry} /></div>
      ) : loading || !rows ? (
        <div className="space-y-3 p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="p-6"><EmptyState title={q ? "No matches" : emptyTitle} description={q ? "Try a different search term." : emptyDescription} /></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {selectable && (
                    <th scope="col" className="w-14 px-5 py-4 sm:px-6">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" className="h-5 w-5 rounded accent-[rgb(var(--primary))]" />
                    </th>
                  )}
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("whitespace-nowrap px-5 py-4 sm:px-6", c.hideOnMobile && "hidden md:table-cell", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                      {c.sortable === false ? c.header : (
                        <button className="inline-flex items-center gap-1.5 uppercase hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                          {c.header}
                          {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slice.map((r) => (
                  <tr key={rowKey(r)} className={cn("hover:bg-muted/40 transition-colors", selected?.has(rowKey(r)) && "bg-primary-soft/50")}>
                    {selectable && (
                      <td className="w-14 px-5 py-4 sm:px-6">
                        <input type="checkbox" disabled={!canSel(r)} checked={!!selected?.has(rowKey(r))} onChange={() => toggleOne(r)} aria-label="Select row" className="h-5 w-5 rounded accent-[rgb(var(--primary))] disabled:opacity-30" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-5 py-4 align-middle sm:px-6", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                        {c.render ? c.render(r) : String(val(c, r))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 text-base text-muted-foreground sm:px-6">
            <span className="font-medium">
              {cur * pageSize + 1}–{Math.min(filtered.length, cur * pageSize + pageSize)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-10 w-10 text-base" onClick={() => setPage(cur - 1)} disabled={cur === 0} aria-label="Previous page">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="px-3 font-semibold text-foreground text-base">{cur + 1} / {pages}</span>
              <Button variant="outline" size="icon" className="h-10 w-10 text-base" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1} aria-label="Next page">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
