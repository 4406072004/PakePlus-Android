import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-neutral-100">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-800 mb-1">
            {this.props.fallbackTitle || '页面遇到了临时小状况'}
          </h3>
          <p className="text-xs text-neutral-500 mb-4 max-w-xs leading-relaxed">
            小手机已自动进行状态保护，数据未丢失，点击下方按钮即可一键恢复。
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复并返回桌面</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
