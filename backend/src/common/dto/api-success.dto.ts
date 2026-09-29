export class ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: any;
}

export class ApiSuccessResponse<T = any> {
  success!: true;
  data!: T;
  meta?: ApiMeta;
  requestId!: string;
  timestamp!: string;
}