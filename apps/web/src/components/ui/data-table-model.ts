export type DataTableState = 'loading' | 'empty' | 'rows';
export function resolveDataTableState(loading: boolean, rowCount: number): DataTableState { return loading ? 'loading' : rowCount === 0 ? 'empty' : 'rows'; }
export function isTableActivationKey(key: string) { return key === 'Enter' || key === ' '; }
