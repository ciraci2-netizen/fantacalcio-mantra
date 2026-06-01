"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(JSON.stringify({ event: "ui_error", label: this.props.label ?? "unknown", msg: error.message, ts: new Date().toISOString() }));
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-2">
          <p className="font-semibold">⚠️ Errore in questa sezione{this.props.label ? ` (${this.props.label})` : ""}</p>
          <p className="text-red-500 text-xs font-mono">{this.state.error?.message ?? "Errore sconosciuto"}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs underline text-red-600 hover:text-red-800"
          >
            Ricarica sezione
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
