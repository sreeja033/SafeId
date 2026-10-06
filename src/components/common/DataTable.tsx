import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto rounded-2xl bg-[#070e1c] border border-white/5 shadow-xl ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#151b2a]/80 text-[#908fa0] text-xs font-semibold uppercase tracking-wider border-b border-[#232a39]">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-3.5 px-4 font-semibold ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#19202e] text-sm text-[#dce2f6]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-12 text-center text-[#908fa0]"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl opacity-40">
                    inbox
                  </span>
                  <span>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-[#151b2a]/60'
                    : 'hover:bg-[#151b2a]/30'
                }`}
              >
                {columns.map((col, idx) => (
                  <td key={idx} className={`py-4 px-4 ${col.className || ''}`}>
                    {col.render
                      ? col.render(item)
                      : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
