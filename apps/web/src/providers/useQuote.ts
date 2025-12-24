import { ContractsVNext } from "@cnc-quote/shared";

type QuoteSummaryVNext = ContractsVNext.QuoteSummaryVNext;
 
type UseQuoteOptions = {
  baseUrl?: string;
  fetchInit?: RequestInit;
};

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost";

export async function useQuote(
  quoteId: string,
  options?: UseQuoteOptions,
): Promise<QuoteSummaryVNext> {
  if (!quoteId) {
    throw new Error("quoteId is required");
  }

  const baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = new URL(
    `/api/quotes/${encodeURIComponent(quoteId)}`,
    `${baseUrl}/`,
  );
  url.searchParams.set("view", "vnext");

  const response = await fetch(url.toString(), {
    ...options?.fetchInit,
    headers: {
      Accept: "application/json",
      ...(options?.fetchInit?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch quote ${quoteId}: HTTP ${response.status}`,
    );
  }

  const json = await response.json();
  return ContractsVNext.QuoteSummarySchema.parse(json);
}
