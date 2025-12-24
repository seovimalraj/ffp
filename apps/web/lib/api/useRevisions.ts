/**
 * Step 16: Revisions React Query Hooks
 * Custom hooks for revision timeline with SWR caching
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  revisionsApi,
  type RevisionListItem,
  type QuoteRevision,
  type CompareRevisionsRequest,
} from "./revisions";

/**
 * List revisions with infinite scroll pagination
 */
export function useRevisions(
  quoteId: string | undefined,
  pageSize: number = 50,
) {
  return useInfiniteQuery({
    queryKey: ["revisions", quoteId],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      revisionsApi.listRevisions(quoteId!, {
        cursor: pageParam,
        limit: pageSize,
      }),
    enabled: !!quoteId,
    getNextPageParam: (lastPage: any) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * Get a specific revision
 */
export function useRevision(
  quoteId: string | undefined,
  revisionId: string | undefined,
) {
  return useQuery({
    queryKey: ["revision", quoteId, revisionId],
    queryFn: () => revisionsApi.getRevision(quoteId!, revisionId!),
    enabled: !!quoteId && !!revisionId,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Compare two revisions
 */
export function useCompareRevisions(quoteId: string) {
  return useMutation({
    mutationFn: (data: CompareRevisionsRequest) =>
      revisionsApi.compareRevisions(quoteId, data),
  });
}

/**
 * Restore a revision
 */
export function useRestoreRevision(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ revisionId, note }: { revisionId: string; note?: string }) =>
      revisionsApi.restoreRevision(quoteId, revisionId, { note }),
    onSuccess: () => {
      // Invalidate all revision and quote queries
      queryClient.invalidateQueries({ queryKey: ["revisions", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

/**
 * Update revision note
 */
export function useUpdateRevisionNote(quoteId: string, revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: string) =>
      revisionsApi.updateNote(quoteId, revisionId, { note }),

    // Optimistic update
    onMutate: async (note: string) => {
      await queryClient.cancelQueries({
        queryKey: ["revision", quoteId, revisionId],
      });

      const previous = queryClient.getQueryData<QuoteRevision>([
        "revision",
        quoteId,
        revisionId,
      ]);

      queryClient.setQueryData(
        ["revision", quoteId, revisionId],
        (old: any) => {
          if (!old) return old;
          return { ...old, note };
        },
      );

      return { previous };
    },

    onError: (err: any, note: string, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["revision", quoteId, revisionId],
          context.previous,
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revisions", quoteId] });
    },
  });
}

/**
 * Group revisions by time periods
 */
export function groupRevisionsByTime(revisions: RevisionListItem[]): {
  today: RevisionListItem[];
  yesterday: RevisionListItem[];
  lastWeek: RevisionListItem[];
  older: RevisionListItem[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups = {
    today: [] as RevisionListItem[],
    yesterday: [] as RevisionListItem[],
    lastWeek: [] as RevisionListItem[],
    older: [] as RevisionListItem[],
  };

  revisions.forEach((rev) => {
    const revDate = new Date(rev.created_at);
    if (revDate >= today) {
      groups.today.push(rev);
    } else if (revDate >= yesterday) {
      groups.yesterday.push(rev);
    } else if (revDate >= lastWeek) {
      groups.lastWeek.push(rev);
    } else {
      groups.older.push(rev);
    }
  });

  return groups;
}
