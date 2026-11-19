// Pager for long tables: the API only returns the rows of one page, so the table stays
// fast even with thousands of records.

export const PAGE_SIZES = [10, 25, 50];

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  noun?: string;
}

// Page numbers to show: always the first and the last, and two around the current one.
function visiblePages(page: number, pages: number): (number | "…")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
    result.push(p);
  });
  return result;
}

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize, noun = "registros" }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="pagination" aria-label="Paginación">
      <p className="pagination-info muted">
        {from}–{to} de {total} {noun}
      </p>
      <div className="pagination-pages">
        <button
          type="button"
          className="page-button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          ‹
        </button>
        {visiblePages(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="page-button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="page-button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
      <label className="pagination-size">
        <span className="muted">Por página</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value));
            onPage(1);
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
