import { ScrollArea } from "@laxdb/ui/components/ui/scroll-area";
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
import { useEffect, useRef, useState, type ReactNode } from "react";

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder,
  initialSorting = [],
  ariaLabel = "Statistics table",
  descriptionId,
  viewportKey,
  toolbarLeading,
  fullscreen = false,
  onFullscreenChange,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder: string;
  initialSorting?: SortingState;
  ariaLabel?: string;
  descriptionId?: string;
  viewportKey?: string;
  toolbarLeading?: ReactNode;
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const tableRoot = useRef<HTMLDivElement>(null);
  const tableViewport = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const fullscreenTrigger = useRef<HTMLButtonElement>(null);
  const wasSearchOpen = useRef(false);
  const wasFullscreen = useRef(false);

  useEffect(() => {
    if (searchOpen) {
      wasSearchOpen.current = true;
    } else if (wasSearchOpen.current) {
      searchTrigger.current?.focus();
      wasSearchOpen.current = false;
    }
  }, [searchOpen]);

  useEffect(() => {
    if (fullscreen) {
      tableViewport.current?.focus();
      wasFullscreen.current = true;
    } else if (wasFullscreen.current) {
      fullscreenTrigger.current?.focus();
      wasFullscreen.current = false;
    }
  }, [fullscreen]);

  useEffect(() => {
    if (onFullscreenChange === undefined) return;

    const handleFullscreenKeys = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        onFullscreenChange(false);
        return;
      }
      if (
        event.key.toLocaleLowerCase() !== "f" ||
        event.repeat ||
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.altKey ||
        isEditableTarget(event.target) ||
        !(event.target instanceof Node) ||
        tableRoot.current?.contains(event.target) !== true
      )
        return;

      event.preventDefault();
      onFullscreenChange(!fullscreen);
    };

    document.addEventListener("keydown", handleFullscreenKeys);
    return () => {
      document.removeEventListener("keydown", handleFullscreenKeys);
    };
  }, [fullscreen, onFullscreenChange]);

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
    <div
      ref={tableRoot}
      className="data-table"
      data-fullscreen={fullscreen || undefined}
      role={fullscreen ? "region" : undefined}
      aria-label={fullscreen ? "Full-screen statistics table" : undefined}
    >
      <div className="data-table-toolbar">
        <div className="data-table-toolbar-leading">{toolbarLeading}</div>
        <div className="data-table-toolbar-actions">
          {searchOpen || globalFilter !== "" ? (
            <div className="data-table-search-field">
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <circle cx="7" cy="7" r="4.25" />
                <path d="m10.25 10.25 3 3" />
              </svg>
              <input
                autoFocus
                type="text"
                role="searchbox"
                aria-label="Search table"
                inputMode="search"
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  resetVerticalScroll();
                }}
                placeholder={searchPlaceholder}
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  setGlobalFilter("");
                  setSearchOpen(false);
                  resetVerticalScroll();
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              ref={searchTrigger}
              className="data-table-toolbar-button"
              type="button"
              onClick={() => {
                setSearchOpen(true);
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <circle cx="7" cy="7" r="4.25" />
                <path d="m10.25 10.25 3 3" />
              </svg>
              Search
            </button>
          )}
          {onFullscreenChange !== undefined && (
            <button
              ref={fullscreenTrigger}
              className="data-table-toolbar-button"
              type="button"
              aria-pressed={fullscreen}
              aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
              onClick={() => {
                onFullscreenChange(!fullscreen);
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                {fullscreen ? (
                  <path d="M6 2.5v3H3M10 2.5v3h3M6 13.5v-3H3M10 13.5v-3h3" />
                ) : (
                  <path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />
                )}
              </svg>
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
          )}
        </div>
      </div>
      <ScrollArea
        key={viewportKey}
        viewportRef={tableViewport}
        viewportTabIndex={0}
        scrollbarOrientation="both"
        className="table-shell"
        role="region"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
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
                        sortable
                          ? sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="data-table-sort"
                          data-sorted={sorted || undefined}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </span>
                          <b aria-hidden="true">
                            {sorted === "asc"
                              ? "↑"
                              : sorted === "desc"
                                ? "↓"
                                : "↕"}
                          </b>
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
      </ScrollArea>
      <div className="data-table-pagination">
        <span aria-live="polite">
          {table.getFilteredRowModel().rows.length} records
          {table.getPageCount() > 1 && (
            <>
              {" · "}Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </>
          )}
        </span>
        {table.getPageCount() > 1 && (
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
        )}
      </div>
    </div>
  );
}
