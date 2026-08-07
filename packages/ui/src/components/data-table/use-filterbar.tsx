import type { Table } from "@tanstack/react-table";
import React from "react";

type FilterBarActions = {
  onAdd?: () => void;
};

type FilterBarContextValue<TData = unknown> = {
  table: Table<TData>;
  actions?: FilterBarActions;
};

const FilterBarContext = React.createContext<FilterBarContextValue | null>(null);

function useFilterBar<TData = unknown>(): FilterBarContextValue<TData> {
  const context = React.use(FilterBarContext);
  if (!context) {
    throw new Error("useFilterBar must be used within a FilterBarProvider");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- React Context erases the table row type.
  return context as FilterBarContextValue<TData>;
}

export { type FilterBarActions, type FilterBarContextValue, FilterBarContext, useFilterBar };
