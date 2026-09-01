import { PaginationMeta } from '@/shared/interfaces/pagination.interface';

export function buildPaginationMeta(total: number, page = 1, perPage = 10): PaginationMeta {
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);

  return {
    total,
    page: safePage,
    perPage: safePerPage,
    lastPage: Math.max(1, Math.ceil(total / safePerPage)),
  };
}

export function getPaginationSkip(page = 1, perPage = 10): number {
  return (Math.max(1, page) - 1) * Math.max(1, perPage);
}
