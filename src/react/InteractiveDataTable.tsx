import * as React from 'react';

export type TableColumn = {key: string; label: string};
export type TableRow = {id: string; values: string[]; status?: string; details?: string};

export interface InteractiveDataTableProps {
  title: string;
  description?: string;
  columns: TableColumn[];
  rows: TableRow[];
}

/** Read-only data with local search, sorting, comparison selection and row inspection. */
export function InteractiveDataTable({title, description, columns, rows}: InteractiveDataTableProps): React.JSX.Element {
  const [search, setSearch] = React.useState('');
  const [order, setOrder] = React.useState<{index: number; direction: 'asc' | 'desc'}>({index: 0, direction:'asc'});
  const [selected, setSelected] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const sorted = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(row => !q || [...row.values, row.status ?? ''].some(v => v.toLowerCase().includes(q)))
      .sort((a,b) => (a.values[order.index] ?? '').localeCompare(b.values[order.index] ?? '',undefined,{numeric:true}) * (order.direction === 'asc'?1:-1));
  },[rows,search,order]);
  const toggle = (id: string) => setSelected(prev => prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  return <section className="a2ui-data-table" aria-label={title}>
    <div className="a2ui-data-table__header">
      <div><div className="a2ui-data-table__kicker">DATA EXPLORER</div>
        <h3>{title}</h3>{description && <p>{description}</p>}</div>
      <label className="a2ui-data-table__search"><span className="a2ui-sr-only">Search table rows</span>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rows…"/></label>
    </div>
    <div className="a2ui-data-table__scroll" role="region" aria-label={title+' table'} tabIndex={0}>
      <table><thead><tr>
        <th scope="col" className="a2ui-data-table__check"><span className="a2ui-sr-only">Select</span></th>
        {columns.map((column,index)=><th key={column.key} scope="col">
          <button type="button" aria-label={'Sort by '+column.label}
            aria-pressed={order.index===index} onClick={()=>setOrder(o=>({index,direction:o.index===index&&o.direction==='asc'?'desc':'asc'}))}>
            {column.label}<span aria-hidden="true">{order.index===index?(order.direction==='asc'?'↑':'↓'):'↕'}</span></button>
        </th>)}
        <th scope="col">Status</th><th scope="col">Details</th>
      </tr></thead><tbody>
        {sorted.map(row=><React.Fragment key={row.id}>
          <tr className={selected.includes(row.id)?'is-selected':''}>
            <td><input type="checkbox" aria-label={'Select '+(row.values[0]??row.id)}
              checked={selected.includes(row.id)} onChange={()=>toggle(row.id)}/></td>
            {columns.map((col,index)=><td key={col.key}>{row.values[index]??'—'}</td>)}
            <td><span className="a2ui-data-table__status">{row.status??'—'}</span></td>
            <td><button type="button" className="a2ui-data-table__expand"
              aria-label={(expanded===row.id?'Hide':'View')+' details for '+(row.values[0]??row.id)}
              aria-expanded={expanded===row.id} onClick={()=>setExpanded(value=>value===row.id?null:row.id)}>
              {expanded===row.id?'Hide':'View'} ↗</button></td>
          </tr>
          {expanded===row.id&&<tr className="a2ui-data-table__details-row">
            <td colSpan={columns.length+3}>{row.details??'No additional details'} </td>
          </tr>}
        </React.Fragment>)}
      </tbody></table>
      {!sorted.length&&<div className="a2ui-data-table__empty">No matching rows. Clear your search to see all items.</div>}
    </div>
    <div className="a2ui-data-table__footer"><span>{sorted.length} of {rows.length} rows</span>
      <div><span>{selected.length} selected</span>
        <button type="button" onClick={()=>setSelected([])} disabled={!selected.length}>Clear selection</button></div>
    </div>
  </section>;
}
