import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart2,
  Check,
  Copy,
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

// 1.5 days in seconds — any gap larger means non-trading days between chips
const GAP_THRESHOLD_SECS = 129600;

function tsToDate(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmt(price: number): string {
  return `$${price.toFixed(2)}`;
}

function GapIndicator({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative inline-flex flex-col items-center justify-start gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Dotted vertical line separator */}
      <div className="gap-indicator flex flex-col items-center justify-center w-5 h-8 cursor-default">
        <div className="flex flex-col items-center gap-[3px]">
          <span className="w-[2px] h-[2px] rounded-full bg-muted-foreground/25" />
          <span className="w-[2px] h-[2px] rounded-full bg-muted-foreground/25" />
          <span className="w-[2px] h-[2px] rounded-full bg-muted-foreground/25" />
        </div>
      </div>
      {/* Spacer to align with date label beneath chips */}
      <span className="text-[11px] font-mono text-transparent leading-none whitespace-nowrap select-none">
        &nbsp;
      </span>
      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-md shadow-lg px-2.5 py-1.5 text-xs font-mono whitespace-nowrap text-muted-foreground">
            {label}
          </div>
          <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
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
      className="relative inline-flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`font-mono text-sm font-bold cursor-default select-none inline-flex items-center justify-center w-8 h-8 rounded-md transition-all ${
          isBull ? "cell-bullish" : "cell-bearish"
        }`}
      >
        {bit}
      </span>
      <span className="text-[11px] font-mono text-muted-foreground leading-none whitespace-nowrap bg-muted/30 rounded px-1">
        {date}
      </span>
      {hovered && open !== undefined && close !== undefined && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs font-mono whitespace-nowrap">
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

function CopyButton({
  sequence,
  index,
}: { sequence: bigint[]; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = sequence.map((b) => b.toString()).join(",");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      data-ocid={`analyzer.result.copy_button.${index}`}
      onClick={handleCopy}
      title="Copy sequence"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary transition-all text-xs font-mono ml-1 shrink-0 self-start mt-1"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-emerald-400"
          >
            <Check className="w-3 h-3" />
            Copied
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            Copy
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function gapLabel(diffSecs: number): string {
  const days = Math.round(diffSecs / 86400);
  if (days === 2) return "Weekend";
  if (days === 3) return "Weekend";
  return `${days - 1}d gap`;
}

function ResultRow({
  result,
  index,
}: {
  result: StockAnalysisResult;
  index: number;
}) {
  const ts = result.timestamps ?? [];
  const hasTimestamps = ts.length > 0;
  const firstDate = hasTimestamps ? tsToDate(ts[0]) : "";
  const lastDate = hasTimestamps ? tsToDate(ts[ts.length - 1]) : "";

  return (
    <motion.div
      data-ocid={`analyzer.result.item.${index}`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
      className="flex flex-col sm:flex-row sm:items-start gap-3 py-5 px-1 border-b border-border/60 last:border-0 group"
    >
      {/* Ticker label */}
      <div className="min-w-[96px] pt-1">
        <span className="font-display font-bold text-xl tracking-widest text-primary drop-shadow-[0_0_12px_oklch(0.78_0.16_75/0.5)]">
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
        <div className="flex flex-col gap-2">
          {/* Sequence chips + gap indicators + copy button */}
          <div className="flex items-start flex-wrap gap-y-1.5">
            {result.sequence.map((bit, i) => {
              const prevTs = i > 0 ? ts[i - 1] : null;
              const currTs = ts[i] ?? null;
              const showGap =
                prevTs !== null &&
                currTs !== null &&
                Number(currTs) - Number(prevTs) > GAP_THRESHOLD_SECS;
              const diffSecs =
                prevTs !== null && currTs !== null
                  ? Number(currTs) - Number(prevTs)
                  : 0;

              return (
                <div
                  key={`seq-${result.ticker}-${i}`}
                  className="inline-flex items-start"
                >
                  {showGap && <GapIndicator label={gapLabel(diffSecs)} />}
                  <SequenceCell
                    bit={Number(bit)}
                    date={
                      hasTimestamps && ts[i] !== undefined
                        ? tsToDate(ts[i])
                        : ""
                    }
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
                </div>
              );
            })}
            <CopyButton sequence={result.sequence} index={index} />
          </div>
          {/* Date range */}
          {firstDate && lastDate && (
            <span className="font-mono text-xs text-muted-foreground/70 tracking-wide">
              {firstDate} – {lastDate}
            </span>
          )}
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

  // Compute a shared date range for the results header
  const firstResult = data?.[0];
  const rangeLabel =
    firstResult &&
    !firstResult.error &&
    firstResult.timestamps &&
    firstResult.timestamps.length > 0
      ? `${tsToDate(firstResult.timestamps[0])} – ${tsToDate(firstResult.timestamps[firstResult.timestamps.length - 1])}`
      : null;

  const hasResults = data && data.length > 0;
  const hasNoData = !hasResults && !isPending && !isError;

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-base tracking-tight header-glow">
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
          className="bg-card border border-border rounded-xl p-6 mb-8 input-card-glow"
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
              className="analyze-btn font-mono font-semibold tracking-wider uppercase text-xs px-6 h-10 gap-2"
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
                className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-red-400"
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
                    {EMPTY_STATE_CELLS.map((kind, idx) => (
                      <div
                        key={kind + String(idx)}
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
                      className="px-2.5 py-1 rounded-md border border-border bg-card hover:border-primary hover:text-primary transition-colors text-xs font-mono text-muted-foreground"
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
                className="bg-card border border-border rounded-xl overflow-hidden results-card-glow"
              >
                <div className="px-6 py-3.5 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      Results
                    </span>
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      {data.length} ticker{data.length !== 1 ? "s" : ""}
                    </span>
                    {rangeLabel && (
                      <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border">
                        {rangeLabel}
                      </span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground/60 ml-auto hidden sm:block">
                      Dates shown below each bar · hover for open/close prices
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
