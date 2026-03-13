import { useMutation } from "@tanstack/react-query";
import type { StockAnalysisResult } from "../backend.d";
import { useActor } from "./useActor";

export interface AnalyzeParams {
  tickers: string[];
  days: number;
}

export function useAnalyzeStocks() {
  const { actor } = useActor();

  return useMutation<StockAnalysisResult[], Error, AnalyzeParams>({
    mutationFn: async ({ tickers, days }: AnalyzeParams) => {
      if (!actor) throw new Error("Backend not available");
      return actor.analyzeStocks(tickers, BigInt(days));
    },
  });
}
