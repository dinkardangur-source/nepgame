import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class AuthErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  public state: State = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected authentication or storage error.' };
  }

  public componentDidCatch(error: Error): void {
    console.error('[AuthErrorBoundary]', error);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-amber-300" style={{ fontFamily: "'Cinzel', serif" }}>
              Kingdom Gateway Interrupted
            </h2>
            <p className="text-sm text-slate-300 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm transition"
            >
              Reload Kingdom Gateway
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
