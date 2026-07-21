import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function DataTable<T>({
  columns,
  data,
  emptyLabel = '조건에 맞는 항목이 없습니다.',
  getRowKey,
  onRowClick,
  selectedKey,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  emptyLabel?: string
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const key = getRowKey(row.original)
            return (
              <TableRow
                aria-selected={key === selectedKey}
                className={cn(onRowClick && 'cursor-pointer', key === selectedKey && 'bg-orange-50 hover:bg-orange-50')}
                key={key}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell className="h-28 text-center text-muted-foreground" colSpan={columns.length}>
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
