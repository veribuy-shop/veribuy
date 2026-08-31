export interface ApiErrorData {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export class ApiError extends Error {
  status: number;
  data?: ApiErrorData;

  constructor(status: number, message: string, data?: ApiErrorData) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface ShippingAddressDto {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}
