"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Error boundary for dashboard widgets.
 * Catches render errors in a widget and shows a small fallback
 * instead of crashing the whole page.
 */
export default class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? "Errore sconosciuto" };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-sm text-red-500">
          <p className="font-medium">⚠ {this.props.title ?? "Widget non disponibile"}</p>
          <p className="text-xs mt-1 text-red-400">{this.state.message}</p>
          <button
            className="mt-2 text-xs text-red-500 underline"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
