import { apiRequest } from './api';

export type ApiHealth = {
  status: 'ok';
  database: 'connected';
  timestamp: string;
};

export function getApiHealth() {
  return apiRequest<ApiHealth>('/v1/health');
}
