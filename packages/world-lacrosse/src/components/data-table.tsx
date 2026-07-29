import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@laxdb/ui/components/ui/popover";
import { ScrollArea } from "@laxdb/ui/components/ui/scroll-area";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type FilterKind = "number" | "select" | "text";
type FilterStage = "property" | "operator" | "value";
type FilterOperator = "contains" | "eq" | "gte" | "gt" | "lte" | "lt" | "neq";

interface FilterDescriptor {
  readonly id: string;
  readonly kind: FilterKind;
  readonly label: string;
  readonly options: readonly string[];
}

interface ParsedFilter {
  readonly operator: FilterOperator;
  readonly value: string;
}

const operatorLabels: Readonly<Record<FilterOperator, string>> = {
  contains: "contains",
  eq: "is",
  neq: "is not",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
};

const operatorOptions: Readonly<Record<FilterKind, readonly FilterOperator[]>> =
  {
    text: ["contains", "eq", "neq"],
    select: ["eq", "neq"],
    number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  };

const isFilterOperator = (value: string): value is FilterOperator =>
  value === "contains" ||
  value === "eq" ||
  value === "neq" ||
  value === "gt" ||
  value === "gte" ||
  value === "lt" ||
  value === "lte";

const parseFilter = (filterValue: unknown): ParsedFilter | null => {
  if (typeof filterValue !== "string") return null;
  const separator = filterValue.indexOf(":");
  if (separator < 1) return null;
  const operator = filterValue.slice(0, separator);
  const value = filterValue.slice(separator + 1);
  if (!isFilterOperator(operator) || value === "") return null;
  return { operator, value };
};

export const dataValueMatchesFilter = (
  value: unknown,
  filterValue: unknown,
): boolean => {
  if (filterValue === undefined || filterValue === null || filterValue === "")
    return true;
  const filter = parseFilter(filterValue);
  if (filter === null) return false;

  if (typeof value === "number") {
    const target = Number(filter.value);
    if (!Number.isFinite(target)) return false;
    switch (filter.operator) {
      case "eq":
        return value === target;
      case "neq":
        return value !== target;
      case "gt":
        return value > target;
      case "gte":
        return value >= target;
      case "lt":
        return value < target;
      case "lte":
        return value <= target;
      case "contains":
        return false;
    }
    return false;
  }

  if (typeof value !== "string") return false;
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedTarget = filter.value.toLocaleLowerCase();
  switch (filter.operator) {
    case "contains":
      return normalizedValue.includes(normalizedTarget);
    case "eq":
      return normalizedValue === normalizedTarget;
    case "neq":
      return normalizedValue !== normalizedTarget;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return false;
  }
  return false;
};

const dataAnalysisFilter = <T,>(
  row: Row<T>,
  columnId: string,
  filterValue: unknown,
): boolean =>
  dataValueMatchesFilter(row.getValue<unknown>(columnId), filterValue);

const defaultColumnLabel = (id: string): string => {
  const words = id
    .replaceAll(/([a-z\d])([A-Z])/gu, "$1 $2")
    .replaceAll("Id", "ID");
  return `${words.charAt(0).toLocaleUpperCase()}${words.slice(1)}`;
};

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
  filterLabels = {},
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
  filterLabels?: Readonly<Record<string, string>>;
  viewportKey?: string;
  toolbarLeading?: ReactNode;
  fullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStage, setFilterStage] = useState<FilterStage>("property");
  const [filterQuery, setFilterQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [draftColumnId, setDraftColumnId] = useState("");
  const [draftOperator, setDraftOperator] = useState<FilterOperator>("eq");
  const [draftValue, setDraftValue] = useState("");
  const tableRoot = useRef<HTMLDivElement>(null);
  const tableViewport = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const fullscreenTrigger = useRef<HTMLButtonElement>(null);
  const filterStagePanel = useRef<HTMLDivElement>(null);
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
    if (!filterOpen || filterStage === "property") return undefined;
    const frame = requestAnimationFrame(() => {
      filterStagePanel.current
        ?.querySelector<HTMLElement>("[data-filter-choice], input")
        ?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [filterOpen, filterStage]);

  useEffect(() => {
    if (onFullscreenChange === undefined) return undefined;

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
    defaultColumn: { filterFn: dataAnalysisFilter },
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: (updater) => {
      setSorting(updater);
      resetVerticalScroll();
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });

  const filterDescriptors = useMemo<readonly FilterDescriptor[]>(
    () =>
      table.getAllLeafColumns().map((column) => {
        const values = table
          .getCoreRowModel()
          .flatRows.map((row) => row.getValue<unknown>(column.id))
          .filter((value) => value !== null && value !== undefined);
        const sampleValue = values[0];
        const kind: FilterKind =
          column.id === "pool"
            ? "select"
            : typeof sampleValue === "number"
              ? "number"
              : "text";
        return {
          id: column.id,
          kind,
          label: filterLabels[column.id] ?? defaultColumnLabel(column.id),
          options:
            kind === "select"
              ? [
                  ...new Set(
                    values.filter(
                      (value): value is string => typeof value === "string",
                    ),
                  ),
                ].toSorted()
              : [],
        };
      }),
    [columns, data, filterLabels, table],
  );
  const selectedDescriptor = filterDescriptors.find(
    (descriptor) => descriptor.id === draftColumnId,
  );
  const draftOperatorOptions: readonly FilterOperator[] =
    selectedDescriptor === undefined
      ? ["eq"]
      : operatorOptions[selectedDescriptor.kind];
  const activeFilters = columnFilters.flatMap((columnFilter) => {
    const filter = parseFilter(columnFilter.value);
    const descriptor = filterDescriptors.find(
      (candidate) => candidate.id === columnFilter.id,
    );
    return filter === null || descriptor === undefined
      ? []
      : [{ descriptor, filter }];
  });
  const visibleFilterDescriptors = filterDescriptors.filter((descriptor) =>
    descriptor.label
      .toLocaleLowerCase()
      .includes(filterQuery.toLocaleLowerCase()),
  );
  const startNewFilter = (): void => {
    setFilterStage("property");
    setFilterQuery("");
    setDraftColumnId("");
    setDraftOperator("eq");
    setDraftValue("");
  };
  const chooseFilterProperty = (
    descriptor: Readonly<FilterDescriptor>,
  ): void => {
    setDraftColumnId(descriptor.id);
    setDraftOperator(descriptor.kind === "text" ? "contains" : "eq");
    setDraftValue("");
    setFilterStage("operator");
  };
  const saveFilter = (
    columnId: string,
    operator: FilterOperator,
    value: string,
  ): void => {
    const normalizedValue = value.trim();
    if (columnId === "" || normalizedValue === "") return;
    table.getColumn(columnId)?.setFilterValue(`${operator}:${normalizedValue}`);
    resetVerticalScroll();
    setFilterOpen(false);
  };

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
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <button
                  className="data-table-toolbar-button"
                  type="button"
                  onClick={startNewFilter}
                />
              }
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="M2.5 3.25h11l-4.25 5v3.25l-2.5 1.25v-4.5z" />
              </svg>
              Filter
              {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              aria-label="Add table filter"
              className="data-table-filter-popover"
              sideOffset={6}
            >
              <div ref={filterStagePanel}>
                {filterStage === "property" ? (
                  <>
                    <div className="data-table-filter-menu-search">
                      <svg aria-hidden="true" viewBox="0 0 16 16">
                        <circle cx="7" cy="7" r="4.25" />
                        <path d="m10.25 10.25 3 3" />
                      </svg>
                      <input
                        autoFocus
                        aria-label="Find a property"
                        value={filterQuery}
                        onChange={(event) => {
                          setFilterQuery(event.target.value);
                        }}
                        placeholder="Filter properties…"
                      />
                    </div>
                    <div className="data-table-filter-menu">
                      {visibleFilterDescriptors.map((descriptor) => (
                        <button
                          key={descriptor.id}
                          type="button"
                          onClick={() => {
                            chooseFilterProperty(descriptor);
                          }}
                        >
                          <span>{descriptor.label}</span>
                          <b aria-hidden="true">›</b>
                        </button>
                      ))}
                      {visibleFilterDescriptors.length === 0 && (
                        <p className="data-table-filter-empty" role="status">
                          No properties found
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="data-table-filter-menu-heading">
                      <button
                        type="button"
                        aria-label="Go back"
                        onClick={() => {
                          setFilterStage(
                            filterStage === "value" ? "operator" : "property",
                          );
                        }}
                      >
                        ‹
                      </button>
                      <div>
                        <span>
                          {filterStage === "operator" ? "Condition" : "Value"}
                        </span>
                        <strong>{selectedDescriptor?.label}</strong>
                      </div>
                    </div>
                    {filterStage === "operator" ? (
                      <div className="data-table-filter-menu">
                        {draftOperatorOptions.map((operator) => (
                          <button
                            key={operator}
                            type="button"
                            data-filter-choice
                            onClick={() => {
                              setDraftOperator(operator);
                              setFilterStage("value");
                            }}
                          >
                            <span>{operatorLabels[operator]}</span>
                            <b aria-hidden="true">›</b>
                          </button>
                        ))}
                      </div>
                    ) : selectedDescriptor?.kind === "select" ? (
                      <div className="data-table-filter-menu">
                        {selectedDescriptor.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            data-filter-choice
                            onClick={() => {
                              saveFilter(
                                selectedDescriptor.id,
                                draftOperator,
                                option,
                              );
                            }}
                          >
                            <span>{option}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <form
                        className="data-table-filter-value-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveFilter(draftColumnId, draftOperator, draftValue);
                        }}
                      >
                        <input
                          autoFocus
                          aria-label={`Filter value for ${selectedDescriptor?.label ?? "property"}`}
                          inputMode={
                            selectedDescriptor?.kind === "number"
                              ? "decimal"
                              : undefined
                          }
                          type={
                            selectedDescriptor?.kind === "number"
                              ? "number"
                              : "text"
                          }
                          step={
                            selectedDescriptor?.kind === "number"
                              ? "any"
                              : undefined
                          }
                          value={draftValue}
                          onChange={(event) => {
                            setDraftValue(event.target.value);
                          }}
                          placeholder={
                            selectedDescriptor?.kind === "number"
                              ? "Enter a number…"
                              : "Enter text…"
                          }
                        />
                        <button
                          type="submit"
                          disabled={draftValue.trim() === ""}
                        >
                          Apply
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
      {activeFilters.length > 0 && (
        <div
          className="data-table-active-filters"
          role="group"
          aria-label="Active filters"
        >
          <div className="data-table-filter-formulas">
            {activeFilters.map(({ descriptor, filter }) => (
              <div key={descriptor.id} className="data-table-filter-formula">
                <span className="data-table-filter-property">
                  {descriptor.label}
                </span>
                <label>
                  <span className="sr-only">
                    Change {descriptor.label} condition
                  </span>
                  <select
                    value={filter.operator}
                    onChange={(event) => {
                      const nextOperator = event.target.value;
                      if (isFilterOperator(nextOperator))
                        saveFilter(descriptor.id, nextOperator, filter.value);
                    }}
                  >
                    {operatorOptions[descriptor.kind].map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabels[operator]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">
                    Change {descriptor.label} value
                  </span>
                  {descriptor.kind === "select" ? (
                    <select
                      value={filter.value}
                      onChange={(event) => {
                        saveFilter(
                          descriptor.id,
                          filter.operator,
                          event.target.value,
                        );
                      }}
                    >
                      {descriptor.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={`${descriptor.id}-${filter.value}`}
                      defaultValue={filter.value}
                      inputMode={
                        descriptor.kind === "number" ? "decimal" : undefined
                      }
                      type={descriptor.kind === "number" ? "number" : "text"}
                      step={descriptor.kind === "number" ? "any" : undefined}
                      size={Math.max(6, Math.min(filter.value.length, 18))}
                      onBlur={(event) => {
                        const nextValue = event.target.value.trim();
                        if (nextValue === "") {
                          table
                            .getColumn(descriptor.id)
                            ?.setFilterValue(undefined);
                        } else {
                          saveFilter(descriptor.id, filter.operator, nextValue);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          event.currentTarget.value = filter.value;
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  )}
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${descriptor.label} filter`}
                  onClick={() => {
                    table.getColumn(descriptor.id)?.setFilterValue(undefined);
                    resetVerticalScroll();
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {activeFilters.length > 1 && (
              <button
                className="data-table-clear-filters"
                type="button"
                onClick={() => {
                  table.resetColumnFilters();
                  resetVerticalScroll();
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
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
