"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught client-side error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#141416] p-6 text-[#EAEAE6]">
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#1C1C1F] p-8 text-center shadow-2xl space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {this.props.fallbackTitle || "Unable to Render Syllabus"}
              </h2>
              <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
                A client-side issue was caught while rendering this syllabus data structure.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-left">
                <span className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
                  Error Details:
                </span>
                <code className="text-xs font-mono text-rose-300 break-words block">
                  {this.state.error.message || String(this.state.error)}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-[#141416] hover:bg-emerald-400 hover:text-[#141416] transition-all shadow"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Page</span>
              </button>

              <Link
                href="/"
                className="inline-flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl border border-[#2E2E34] bg-[#141416] px-5 py-2.5 text-xs font-semibold text-white hover:border-[#EAEAE6] transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-[#EAEAE6]" />
                <span>Return to Catalog</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
