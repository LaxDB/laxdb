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
import { useEffect, useRef, useState, type ReactNode } from "react";

type FilterKind = "multi-select" | "number" | "select" | "text";
type ScalarFilterKind = Exclude<FilterKind, "multi-select">;
type FilterStage = "property" | "operator" | "value";
type FilterOperator = "contains" | "eq" | "gte" | "gt" | "lte" | "lt" | "neq";
type TextFilterOperator = "contains" | "eq" | "neq";
type SelectFilterOperator = "eq" | "neq";
type NumberFilterOperator = Exclude<FilterOperator, "contains">;

interface BaseFilterDefinition {
  readonly id: string;
  readonly label: string;
}

export type DataTableFilterDefinition =
  | (BaseFilterDefinition & { readonly kind: "number" })
  | (BaseFilterDefinition & { readonly kind: "text" })
  | (BaseFilterDefinition & {
      readonly kind: "select";
      readonly options: readonly string[];
    })
  | (BaseFilterDefinition & {
      readonly kind: "multi-select";
      readonly options: readonly string[];
    });

export type DataTableFilterValue =
  | {
      readonly kind: "text";
      readonly operator: TextFilterOperator;
      readonly value: string;
    }
  | {
      readonly kind: "select";
      readonly operator: SelectFilterOperator;
      readonly value: string;
    }
  | {
      readonly kind: "number";
      readonly operator: NumberFilterOperator;
      readonly value: number;
    }
  | { readonly kind: "multi-select"; readonly values: readonly string[] };

const operatorLabels: Readonly<Record<FilterOperator, string>> = {
  contains: "contains",
  eq: "is",
  neq: "is not",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
};

const operatorOptions: Readonly<
  Record<ScalarFilterKind, readonly FilterOperator[]>
> = {
  text: ["contains", "eq", "neq"],
  select: ["eq", "neq"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
};

const operatorsForFilter = (
  descriptor: Readonly<DataTableFilterDefinition>,
): readonly FilterOperator[] =>
  descriptor.kind === "multi-select" ? [] : operatorOptions[descriptor.kind];

const isTextFilterOperator = (value: unknown): value is TextFilterOperator =>
  value === "contains" || value === "eq" || value === "neq";

const isSelectFilterOperator = (
  value: unknown,
): value is SelectFilterOperator => value === "eq" || value === "neq";

const isNumberFilterOperator = (
  value: unknown,
): value is NumberFilterOperator =>
  value === "eq" ||
  value === "neq" ||
  value === "gt" ||
  value === "gte" ||
  value === "lt" ||
  value === "lte";

const isFilterOperator = (value: unknown): value is FilterOperator =>
  isTextFilterOperator(value) || isNumberFilterOperator(value);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.every((candidate: unknown) => typeof candidate === "string");

const parseFilter = (filterValue: unknown): DataTableFilterValue | null => {
  if (!isRecord(filterValue) || typeof filterValue.kind !== "string")
    return null;

  if (
    filterValue.kind === "text" &&
    isTextFilterOperator(filterValue.operator) &&
    typeof filterValue.value === "string" &&
    filterValue.value !== ""
  )
    return {
      kind: "text",
      operator: filterValue.operator,
      value: filterValue.value,
    };

  if (
    filterValue.kind === "select" &&
    isSelectFilterOperator(filterValue.operator) &&
    typeof filterValue.value === "string" &&
    filterValue.value !== ""
  )
    return {
      kind: "select",
      operator: filterValue.operator,
      value: filterValue.value,
    };

  if (
    filterValue.kind === "number" &&
    isNumberFilterOperator(filterValue.operator) &&
    typeof filterValue.value === "number" &&
    Number.isFinite(filterValue.value)
  )
    return {
      kind: "number",
      operator: filterValue.operator,
      value: filterValue.value,
    };

  if (
    filterValue.kind === "multi-select" &&
    isStringArray(filterValue.values) &&
    filterValue.values.length > 0
  )
    return { kind: "multi-select", values: filterValue.values };

  return null;
};

const filterMatchesDefinition = (
  filter: Readonly<DataTableFilterValue>,
  descriptor: Readonly<DataTableFilterDefinition>,
): boolean => filter.kind === descriptor.kind;

const createScalarFilter = (
  descriptor: Readonly<DataTableFilterDefinition>,
  operator: FilterOperator,
  rawValue: string,
): DataTableFilterValue | null => {
  const value = rawValue.trim();
  if (value === "" || descriptor.kind === "multi-select") return null;

  if (descriptor.kind === "text" && isTextFilterOperator(operator))
    return { kind: "text", operator, value };

  if (descriptor.kind === "select" && isSelectFilterOperator(operator))
    return { kind: "select", operator, value };

  if (descriptor.kind === "number" && isNumberFilterOperator(operator)) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? { kind: "number", operator, value: numericValue }
      : null;
  }

  return null;
};

export const dataValueMatchesFilter = (
  value: unknown,
  filterValue: unknown,
): boolean => {
  if (filterValue === undefined || filterValue === null || filterValue === "")
    return true;
  const filter = parseFilter(filterValue);
  if (filter === null) return false;

  if (filter.kind === "number") {
    if (typeof value !== "number") return false;
    switch (filter.operator) {
      case "eq":
        return value === filter.value;
      case "neq":
        return value !== filter.value;
      case "gt":
        return value > filter.value;
      case "gte":
        return value >= filter.value;
      case "lt":
        return value < filter.value;
      case "lte":
        return value <= filter.value;
    }
  }

  if (typeof value !== "string") return false;
  const normalizedValue = value.toLocaleLowerCase();
  if (filter.kind === "multi-select")
    return filter.values.some(
      (target) => normalizedValue === target.toLocaleLowerCase(),
    );

  const normalizedTarget = filter.value.toLocaleLowerCase();
  switch (filter.operator) {
    case "contains":
      return normalizedValue.includes(normalizedTarget);
    case "eq":
      return normalizedValue === normalizedTarget;
    case "neq":
      return normalizedValue !== normalizedTarget;
  }
  return false;
};

const dataAnalysisFilter = <T,>(
  row: Row<T>,
  columnId: string,
  filterValue: unknown,
): boolean =>
  dataValueMatchesFilter(row.getValue<unknown>(columnId), filterValue);

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");

const summarizeSelectedValues = (values: readonly string[]): string =>
  values.length <= 2
    ? values.join(", ")
    : `${values[0] ?? ""} and ${values.length - 1} more`;

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder,
  initialSorting = [],
  ariaLabel = "Statistics table",
  filters = [],
  viewportKey,
  toolbarLeading,
  toolbarActions,
  fullscreen = false,
  onFullscreenChange,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder: string;
  initialSorting?: SortingState;
  ariaLabel?: string;
  filters?: readonly DataTableFilterDefinition[];
  viewportKey?: string;
  toolbarLeading?: ReactNode;
  toolbarActions?: ReactNode;
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
  const [draftSelectedValues, setDraftSelectedValues] = useState<string[]>([]);
  const tableRoot = useRef<HTMLDivElement>(null);
  const tableViewport = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const filterReturnFocus = useRef<HTMLButtonElement>(null);
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
    if (!filterOpen || filterStage === "property") return;
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
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
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

  const filterDescriptors = filters.filter(
    (descriptor) => table.getColumn(descriptor.id) !== undefined,
  );
  const selectedDescriptor = filterDescriptors.find(
    (descriptor) => descriptor.id === draftColumnId,
  );
  const draftOperatorOptions: readonly FilterOperator[] =
    selectedDescriptor === undefined
      ? ["eq"]
      : operatorsForFilter(selectedDescriptor);
  const activeFilters = columnFilters.flatMap((columnFilter) => {
    const filter = parseFilter(columnFilter.value);
    const descriptor = filterDescriptors.find(
      (candidate) => candidate.id === columnFilter.id,
    );
    return filter === null ||
      descriptor === undefined ||
      !filterMatchesDefinition(filter, descriptor)
      ? []
      : [{ descriptor, filter }];
  });
  const visibleFilterDescriptors = filterDescriptors.filter((descriptor) =>
    descriptor.label
      .toLocaleLowerCase()
      .includes(filterQuery.toLocaleLowerCase()),
  );
  const startNewFilter = (): void => {
    filterReturnFocus.current = filterTrigger.current;
    setFilterStage("property");
    setFilterQuery("");
    setDraftColumnId("");
    setDraftOperator("eq");
    setDraftValue("");
    setDraftSelectedValues([]);
  };
  const chooseFilterProperty = (
    descriptor: Readonly<DataTableFilterDefinition>,
  ): void => {
    const currentFilter = parseFilter(
      table.getColumn(descriptor.id)?.getFilterValue(),
    );
    const matchingFilter =
      currentFilter !== null &&
      filterMatchesDefinition(currentFilter, descriptor)
        ? currentFilter
        : null;
    setDraftColumnId(descriptor.id);

    if (descriptor.kind === "multi-select") {
      setDraftSelectedValues(
        matchingFilter?.kind === "multi-select"
          ? [...matchingFilter.values]
          : [],
      );
      setFilterStage("value");
      return;
    }

    setDraftOperator(
      matchingFilter !== null && matchingFilter.kind !== "multi-select"
        ? matchingFilter.operator
        : descriptor.kind === "text"
          ? "contains"
          : "eq",
    );
    setDraftValue(
      matchingFilter !== null && matchingFilter.kind !== "multi-select"
        ? String(matchingFilter.value)
        : "",
    );
    setFilterStage("operator");
  };
  const saveFilter = (
    descriptor: Readonly<DataTableFilterDefinition>,
    operator: FilterOperator,
    value: string,
  ): void => {
    const filter = createScalarFilter(descriptor, operator, value);
    if (filter === null) return;
    table.getColumn(descriptor.id)?.setFilterValue(filter);
    resetVerticalScroll();
    setFilterOpen(false);
  };
  const saveMultiSelectFilter = (
    descriptor: Readonly<DataTableFilterDefinition>,
    values: readonly string[],
  ): void => {
    if (descriptor.kind !== "multi-select" || values.length === 0) return;
    table
      .getColumn(descriptor.id)
      ?.setFilterValue({ kind: "multi-select", values });
    resetVerticalScroll();
    setFilterOpen(false);
  };
  const openMultiSelectFilter = (
    descriptor: Readonly<DataTableFilterDefinition>,
    filter: Readonly<DataTableFilterValue>,
    returnFocus: HTMLButtonElement,
  ): void => {
    if (descriptor.kind !== "multi-select" || filter.kind !== "multi-select")
      return;
    filterReturnFocus.current = returnFocus;
    setDraftColumnId(descriptor.id);
    setDraftSelectedValues([...filter.values]);
    setFilterStage("value");
    setFilterOpen(true);
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
          {toolbarActions}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <button
                  ref={filterTrigger}
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
              finalFocus={() => filterReturnFocus.current}
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
                            filterStage === "value" &&
                              selectedDescriptor?.kind !== "multi-select"
                              ? "operator"
                              : "property",
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
                    ) : selectedDescriptor?.kind === "multi-select" ? (
                      <form
                        className="data-table-filter-multi-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveMultiSelectFilter(
                            selectedDescriptor,
                            draftSelectedValues,
                          );
                        }}
                      >
                        <fieldset className="data-table-filter-options">
                          <legend className="sr-only">
                            Select {selectedDescriptor.label}
                          </legend>
                          {selectedDescriptor.options.map((option) => (
                            <label key={option}>
                              <input
                                data-filter-choice
                                type="checkbox"
                                checked={draftSelectedValues.includes(option)}
                                onChange={(event) => {
                                  setDraftSelectedValues((current) =>
                                    event.target.checked
                                      ? [...current, option]
                                      : current.filter(
                                          (value) => value !== option,
                                        ),
                                  );
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </fieldset>
                        <div className="data-table-filter-multi-actions">
                          <span>{draftSelectedValues.length} selected</span>
                          <button
                            type="submit"
                            disabled={draftSelectedValues.length === 0}
                          >
                            Apply
                          </button>
                        </div>
                      </form>
                    ) : selectedDescriptor?.kind === "select" ? (
                      <div className="data-table-filter-menu">
                        {selectedDescriptor.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            data-filter-choice
                            onClick={() => {
                              saveFilter(
                                selectedDescriptor,
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
                          if (selectedDescriptor !== undefined)
                            saveFilter(
                              selectedDescriptor,
                              draftOperator,
                              draftValue,
                            );
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
              aria-keyshortcuts="F"
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
            {activeFilters.map(({ descriptor, filter }) => {
              const scalarValue =
                filter.kind === "multi-select" ? "" : String(filter.value);
              return (
                <div key={descriptor.id} className="data-table-filter-formula">
                  <span className="data-table-filter-property">
                    {descriptor.label}
                  </span>
                  {filter.kind === "multi-select" ? (
                    <>
                      <span className="data-table-filter-operator">
                        is any of
                      </span>
                      <button
                        className="data-table-filter-multi-value"
                        type="button"
                        aria-label={`Change ${descriptor.label} values: ${filter.values.join(", ")}`}
                        onClick={(event) => {
                          openMultiSelectFilter(
                            descriptor,
                            filter,
                            event.currentTarget,
                          );
                        }}
                      >
                        {summarizeSelectedValues(filter.values)}
                      </button>
                    </>
                  ) : (
                    <>
                      <label>
                        <span className="sr-only">
                          Change {descriptor.label} condition
                        </span>
                        <select
                          value={filter.operator}
                          onChange={(event) => {
                            const nextOperator = event.target.value;
                            if (isFilterOperator(nextOperator))
                              saveFilter(descriptor, nextOperator, scalarValue);
                          }}
                        >
                          {operatorsForFilter(descriptor).map((operator) => (
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
                        {descriptor.kind === "select" &&
                        filter.kind === "select" ? (
                          <select
                            value={filter.value}
                            onChange={(event) => {
                              saveFilter(
                                descriptor,
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
                            key={`${descriptor.id}-${scalarValue}`}
                            defaultValue={scalarValue}
                            inputMode={
                              descriptor.kind === "number"
                                ? "decimal"
                                : undefined
                            }
                            type={
                              descriptor.kind === "number" ? "number" : "text"
                            }
                            step={
                              descriptor.kind === "number" ? "any" : undefined
                            }
                            size={Math.max(6, Math.min(scalarValue.length, 18))}
                            onBlur={(event) => {
                              const nextValue = event.target.value.trim();
                              if (nextValue === "") {
                                table
                                  .getColumn(descriptor.id)
                                  ?.setFilterValue(undefined);
                              } else {
                                saveFilter(
                                  descriptor,
                                  filter.operator,
                                  nextValue,
                                );
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                event.currentTarget.blur();
                              if (event.key === "Escape") {
                                event.currentTarget.value = scalarValue;
                                event.currentTarget.blur();
                              }
                            }}
                          />
                        )}
                      </label>
                    </>
                  )}
                  <button
                    className="data-table-filter-remove"
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
              );
            })}
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
