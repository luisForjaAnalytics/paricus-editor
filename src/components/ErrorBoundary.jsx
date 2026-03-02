import { Component } from "react"
import i18next from "i18next"

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>{i18next.t("errors.somethingWrong")}</h2>
          <p style={{ color: "#666", marginTop: "0.5rem" }}>
            {this.state.error?.message || i18next.t("errors.unexpected")}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
              background: "#fff",
            }}>
            {i18next.t("errors.tryAgain")}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
