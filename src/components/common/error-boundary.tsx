"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
            <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
              出了点问题
            </h2>
            <p className="mb-4 text-sm text-red-600 dark:text-red-300">
              {this.state.error?.message || "页面发生了未知错误"}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
