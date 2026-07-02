import { Component, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          height: "100%",
          color: "var(--danger)",
        }}>
          <strong>{this.props.label ?? "Error"}</strong>
          <pre style={{
            fontSize: 11,
            color: "var(--text-muted)",
            whiteSpace: "pre-wrap",
            maxWidth: "80%",
            textAlign: "center",
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.handleRetry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 4,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
