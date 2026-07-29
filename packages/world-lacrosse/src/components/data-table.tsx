import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRef, useState } from "react";

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder,
  initialSorting = [],
  ariaLabel = "Statistics table",
  descriptionId,
  viewportKey,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder: string;
  initialSorting?: SortingState;
  ariaLabel?: string;
  descriptionId?: string;
  viewportKey?: string;
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const tableViewport = useRef<HTMLDivElement>(null);
  const resetVerticalScroll = (): void => {
    if (tableViewport.current) tableViewport.current.scrollTop = 0;
  };
  const table = useReactTable({
    columns,
    data,
    state: { sorting, globalFilter },
    onSortingChange: (updater) => {
      setSorting(updater);
      resetVerticalScroll();
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });

  return (
    <div className="data-table">
      <div className="data-table-toolbar">
        <label>
          <span className="sr-only">Search table</span>
          <input
            type="search"
            value={globalFilter}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              resetVerticalScroll();
            }}
            placeholder={searchPlaceholder}
          />
        </label>
        <span>{table.getFilteredRowModel().rows.length} records</span>
      </div>
      <div
        key={viewportKey}
        ref={tableViewport}
        className="table-shell"
        role="region"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        tabIndex={0}
      >
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        !sortable
                          ? undefined
                          : sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <span aria-hidden="true">
                            {sorted === "asc"
                              ? " ↑"
                              : sorted === "desc"
                                ? " ↓"
                                : " ↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="data-table-pagination">
        <span aria-live="polite">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <div>
          <button
            type="button"
            onClick={() => {
              table.previousPage();
              resetVerticalScroll();
            }}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              table.nextPage();
              resetVerticalScroll();
            }}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
