import type { ColumnDef, Table } from "@tanstack/react-table";
import React from "react";

type DataTableContextValue<TData = unknown> = {
  table: Table<TData>;
  columns: ColumnDef<TData>[];
};

const DataTableContext = React.createContext<DataTableContextValue | null>(null);

function useDataTable<TData = unknown>(): DataTableContextValue<TData> {
  const context = React.use(DataTableContext);
  if (!context) {
    throw new Error("useDataTable must be used within a DataTableProvider");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- React Context erases the table row type.
  return context as DataTableContextValue<TData>;
}

export { type DataTableContextValue, DataTableContext, useDataTable };
