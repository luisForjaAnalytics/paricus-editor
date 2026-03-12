import { SimpleEditor } from "./SimpleEditor"
import { ErrorBoundary } from "./components/ErrorBoundary"
import "./editor.scss"

function App() {
  return (
    <ErrorBoundary>
      <SimpleEditor responsive={true} />
    </ErrorBoundary>
  )
}

export default App
