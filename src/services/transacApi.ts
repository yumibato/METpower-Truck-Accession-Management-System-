import { Transaction } from '../types/Transaction';

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const REFRESH_TRIGGER_URL = (import.meta.env.VITE_REFRESH_TRIGGER_URL || '').trim();

const withBase = (path: string) => (API_ROOT ? `${API_ROOT}${path}` : path);

const buildUrl = (path: string, params?: TransacListParams) => {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.set(key, String(value));
    });
  }
  const query = searchParams.toString();
  const url = withBase(path);
  return query ? `${url}?${query}` : url;
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response;
};

const mapTransaction = (row: Record<string, any>): Transaction => ({
  id: row.id,
  trans_no: row.trans_no ?? null,
  barge_details: row.barge_details ?? null,
  plate: row.plate ?? null,
  initial_net_wt: row.initial_net_wt ?? null,
  inbound: row.inbound ?? null,
  outbound: row.outbound ?? null,
  driver: row.driver ?? null,
  type_veh: row.type_veh ?? null,
  product: row.product ?? null,
  ws_no: row.ws_no ?? null,
  dr_no: row.dr_no ?? null,
  del_comp: row.del_comp ?? null,
  del_address: row.del_address ?? null,
  gross_weight: row.gross_weight ?? null,
  tare_weight: row.tare_weight ?? null,
  net_weight: row.net_weight ?? null,
  inbound_wt: row.inbound_wt ?? null,
  outbound_wt: row.outbound_wt ?? null,
  remarks: row.remarks ?? row.Remarks ?? null,
  transac_date: row.transac_date ?? null,
  date: row.date ?? null,
  status: row.status ?? null,
  vessel_id: row.vessel_id ?? null,
  weigher: row.weigher ?? null,
  no_of_bags: row.no_of_bags ?? row.No_of_Bags ?? null,
  created_at: row.created_at ?? row.createdAt ?? null,
  updated_at: row.updated_at ?? row.updatedAt ?? null
});

export interface TransacListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  startDate?: string | null;
  endDate?: string | null;
  exportMode?: boolean; // Special flag to bypass pagination limits
}

export interface TransacListResult {
  rows: Transaction[];
  page: number;
  pageSize: number;
  total: number;
}

const list = async (params: TransacListParams = {}): Promise<TransacListResult> => {
  const url = buildUrl('/api/transac', params);
  const response = await handleResponse(await fetch(url));
  const data = await response.json();
  return {
    rows: (data.rows || data.data || []).map(mapTransaction),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total
  };
};

const get = async (id: number): Promise<Transaction> => {
  const response = await handleResponse(await fetch(withBase(`/api/transac/${id}`)));
  const data = await response.json();
  return mapTransaction(data);
};

const create = async (payload: Partial<Transaction>): Promise<Transaction> => {
  const response = await handleResponse(
    await fetch(withBase('/api/transac'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
  const data = await response.json();
  return mapTransaction(data);
};

const update = async (id: number, payload: Partial<Transaction>): Promise<Transaction> => {
  const response = await handleResponse(
    await fetch(withBase(`/api/transac/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
  const data = await response.json();
  return mapTransaction(data);
};

const remove = async (id: number): Promise<void> => {
  await handleResponse(
    await fetch(withBase(`/api/transac/${id}`), {
      method: 'DELETE'
    })
  );
};

const exportCsv = async (params: TransacListParams = {}): Promise<void> => {
  const url = buildUrl('/api/transac/export', params);
  const response = await handleResponse(await fetch(url));
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `transac_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

const triggerRefresh = async (): Promise<void> => {
  if (!REFRESH_TRIGGER_URL) {
    console.warn('VITE_REFRESH_TRIGGER_URL is not configured; skipping refresh trigger call.');
    return;
  }
  await handleResponse(await fetch(REFRESH_TRIGGER_URL));
};

// Bulk Operations
const bulkDelete = async (ids: number[]): Promise<void> => {
  await handleResponse(
    await fetch(withBase('/api/transac/bulk/delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  );
};

const bulkRestore = async (ids: number[]): Promise<void> => {
  await handleResponse(
    await fetch(withBase('/api/transac/bulk/restore'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  );
};

const bulkUpdateStatus = async (ids: number[], status: string): Promise<void> => {
  await handleResponse(
    await fetch(withBase('/api/transac/bulk/status'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    })
  );
};

const bulkExportCsv = async (ids: number[]): Promise<void> => {
  const response = await handleResponse(
    await fetch(withBase('/api/transac/bulk/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  );
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `transac_bulk_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

// Calendar API function
export interface CalendarDay {
  date: string;
  day: number;
  isInMonth: boolean;
  hasTransactions: boolean;
  isToday: boolean;
}

export interface CalendarData {
  year: number;
  month: number;
  availableDates: string[];
  calendarDays: CalendarDay[];
  totalAvailable: number;
}

export const getCalendarData = async (year: number, month: number): Promise<CalendarData> => {
  const searchParams = new URLSearchParams();
  searchParams.set('year', String(year));
  searchParams.set('month', String(month));
  
  const url = withBase(`/api/calendar?${searchParams.toString()}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json() as CalendarData;
};

export const transacApi = {
  list,
  get,
  create,
  update,
  remove,
  exportCsv,
  triggerRefresh,
  getCalendarData,
  bulkDelete,
  bulkRestore,
  bulkUpdateStatus,
  bulkExportCsv
};

