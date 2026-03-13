import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart2,
  Loader2,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import type { StockAnalysisResult } from "./backend.d";
import { useAnalyzeStocks } from "./hooks/useQueries";

const queryClient = new QueryClient();

const EXAMPLE_TICKERS = ["TSLA", "NVDA", "SPY", "AAPL"];
const EMPTY_STATE_CELLS: Array<"bear" | "bull"> = [
  "bear",
  "bull",
  "bear",
  "bull",
  "bull",
];

function getTradingDates(days: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);

  while (dates.length < days) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(
        cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      );
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates.reverse();
}

function fmt(price: number): string {
  return `$${price.toFixed(2)}`;
}

function SequenceCell({
  bit,
  date,
  open,
  close,
}: {
  bit: number;
  date: string;
  open: number | undefined;
  close: number | undefined;
}) {
  const [hovered, setHovered] = useState(false);
  const isBull = bit === 1;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`font-mono text-base cursor-default select-none px-0.5 rounded transition-colors ${
          isBull
            ? "text-emerald-400 hover:bg-emerald-500/10"
            : "text-red-400 hover:bg-red-500/10"
        }`}
      >
        {bit}
      </span>
      {hovered && open !== undefined && close !== undefined && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs font-mono whitespace-nowrap">
            <div className="text-muted-foreground mb-1 text-center">{date}</div>
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Open</span>
                <span className="text-foreground">{fmt(open)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Close</span>
                <span className={isBull ? "text-emerald-400" : "text-red-400"}>
                  {fmt(close)}
                </span>
              </div>
            </div>
          </div>
          <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  index,
}: {
  result: StockAnalysisResult;
  index: number;
}) {
  const seqLen = result.sequence.length;
  const dates = getTradingDates(seqLen);
  const firstDate = dates[0] ?? "";
  const lastDate = dates[dates.length - 1] ?? "";

  return (
    <motion.div
      data-ocid={`analyzer.result.item.${index}`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
      className="flex flex-col sm:flex-row sm:items-start gap-2 py-4 border-b border-border last:border-0"
    >
      <div className="min-w-[90px] pt-0.5">
        <span className="font-display font-bold text-lg tracking-widest text-primary">
          {result.ticker}
        </span>
      </div>

      {result.error ? (
        <div
          data-ocid={`analyzer.result.error_state.${index}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-destructive/10 border border-destructive/30 text-sm text-red-400"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-mono text-xs">{result.error}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center flex-wrap gap-x-0 gap-y-0">
            {Array.from(result.sequence).map((bit, i) => (
              <span key={`seq-${result.ticker}-${i}`}>
                <SequenceCell
                  bit={Number(bit)}
                  date={dates[i] ?? ""}
                  open={
                    result.opens?.[i] !== undefined
                      ? Number(result.opens[i])
                      : undefined
                  }
                  close={
                    result.closes?.[i] !== undefined
                      ? Number(result.closes[i])
                      : undefined
                  }
                />
                {i < result.sequence.length - 1 && (
                  <span className="font-mono text-muted-foreground/40 text-base">
                    ,
                  </span>
                )}
              </span>
            ))}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {firstDate} – {lastDate}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function Analyzer() {
  const [tickerInput, setTickerInput] = useState("");
  const [days, setDays] = useState(8);
  const { mutate, isPending, isError, error, data } = useAnalyzeStocks();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = () => {
    const tickers = tickerInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) {
      inputRef.current?.focus();
      return;
    }
    mutate({ tickers, days });
  };

  const hasResults = data && data.length > 0;
  const hasNoData = !hasResults && !isPending && !isError;

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-base tracking-tight text-foreground">
              Stock Sequence Analyzer
            </span>
          </div>
          <div className="ml-auto text-xs font-mono text-muted-foreground hidden sm:block">
            OHLC · Binary Patterns · Yahoo Finance
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10">
        {/* Input card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-card border border-border rounded-lg p-6 mb-8 shadow-amber"
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h1 className="font-display font-semibold text-sm uppercase tracking-widest text-muted-foreground">
              Configure Analysis
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="ticker-input"
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
              >
                Ticker Symbols
              </Label>
              <Input
                id="ticker-input"
                ref={inputRef}
                data-ocid="analyzer.ticker_input"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="TSLA, NVDA, SPY"
                className="font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal bg-background border-border focus:border-primary text-foreground"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="days-input"
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
              >
                Trading Days
              </Label>
              <Input
                id="days-input"
                data-ocid="analyzer.days_input"
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) =>
                  setDays(Math.max(1, Math.min(60, Number(e.target.value))))
                }
                className="w-24 font-mono bg-background border-border focus:border-primary text-foreground text-center"
              />
            </div>

            <Button
              type="button"
              data-ocid="analyzer.submit_button"
              onClick={handleAnalyze}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-semibold tracking-wider uppercase text-xs px-6 h-10 gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Analyze
                </>
              )}
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground font-mono">
            Enter one or more symbols separated by commas or spaces. Press Enter
            or click Analyze.
          </p>
        </motion.section>

        {/* Results */}
        <section>
          {/* Loading */}
          <AnimatePresence>
            {isPending && (
              <motion.div
                data-ocid="analyzer.loading_state"
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-16 text-muted-foreground"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-border" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-t-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-mono text-sm text-foreground">
                    Fetching market data
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    Querying Yahoo Finance via HTTP outcalls...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {isError && (
              <motion.div
                data-ocid="analyzer.error_state"
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-red-400"
              >
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-mono text-sm font-semibold">
                    Analysis Failed
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    {error?.message ??
                      "An unexpected error occurred. Please try again."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          <AnimatePresence>
            {hasNoData && (
              <motion.div
                data-ocid="analyzer.empty_state"
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6 py-20 text-center"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl border border-border bg-card flex items-center justify-center">
                    <BarChart2 className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex gap-0.5">
                    {EMPTY_STATE_CELLS.map((kind) => (
                      <div
                        key={`preview-${kind}-${Math.random().toString(36).slice(2)}`}
                        className={`w-2.5 h-2.5 rounded-sm ${
                          kind === "bull"
                            ? "bg-emerald-500/30"
                            : "bg-red-500/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-display font-semibold text-foreground text-base">
                    No analysis yet
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1.5 max-w-xs">
                    Enter ticker symbols above and click{" "}
                    <span className="text-primary">Analyze</span> to see the
                    binary sequence for each stock.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {EXAMPLE_TICKERS.map((ticker) => (
                    <button
                      type="button"
                      key={ticker}
                      onClick={() =>
                        setTickerInput((prev) =>
                          prev ? `${prev}, ${ticker}` : ticker,
                        )
                      }
                      className="px-2.5 py-1 rounded border border-border bg-card hover:border-primary hover:text-primary transition-colors text-xs font-mono text-muted-foreground"
                    >
                      {ticker}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results list */}
          <AnimatePresence>
            {hasResults && (
              <motion.div
                data-ocid="analyzer.results_list"
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <div className="px-6 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      Results
                    </span>
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {data.length} ticker{data.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground ml-auto">
                      Hover each digit for open/close prices
                    </span>
                  </div>
                </div>
                <div className="px-6">
                  {data.map((result, i) => (
                    <ResultRow
                      key={result.ticker}
                      result={result}
                      index={i + 1}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center">
          <p className="text-xs font-mono text-muted-foreground">
            © {new Date().getFullYear()}. Built with ❤ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Analyzer />
    </QueryClientProvider>
  );
}
