import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  });
}

export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: api.uploads,
  });
}

export function useSummary(uploadId: string) {
  return useQuery({
    queryKey: ['summary', uploadId],
    queryFn: () => api.summary(uploadId),
    enabled: !!uploadId,
  });
}

export function useIncidents(uploadId: string) {
  return useQuery({
    queryKey: ['incidents', uploadId],
    queryFn: () => api.incidents(uploadId),
    enabled: !!uploadId,
  });
}

export function useTimeline(uploadId: string) {
  return useQuery({
    queryKey: ['timeline', uploadId],
    queryFn: () => api.timeline(uploadId),
    enabled: !!uploadId,
  });
}
