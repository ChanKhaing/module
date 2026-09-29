export class ApiErrorDetail {
  field?: string;
  message!: string;
}

export class ApiErrorBody {
  code!: string;
  message!: string;
  details?: ApiErrorDetail[] | string[];
}

export class ApiErrorResponse {
  success!: false;
  error!: ApiErrorBody;
  requestId!: string;
  path!: string;
  timestamp!: string;
}