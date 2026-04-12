import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidMount() {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00', marginBottom: '16px' }}>Erro na aplicação</h2>
          <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', overflow: 'auto', fontSize: '12px', color: '#333' }}>
            {this.state.error?.message}{'\n\n'}{this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function HideLoader({ children }) {
  React.useEffect(() => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  }, []);
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ThemeProvider>
      <HideLoader>
        <App />
      </HideLoader>
    </ThemeProvider>
  </ErrorBoundary>
);
