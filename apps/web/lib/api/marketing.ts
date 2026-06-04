import { JsonBody, request } from './client';

export type DemoRequestResult = {
  id: string;
  status: string;
  createdAt: string;
};

export const marketingApi = {
  submitDemoRequest: (body: JsonBody) =>
    request<DemoRequestResult>('/demo-requests', {
      method: 'POST',
      json: body,
      auth: false,
    }),
};
