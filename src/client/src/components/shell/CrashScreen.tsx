import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { COMFORCE_HOTLINE } from './EmergencyBar';

interface Props {
  /** Quick Exit still has to work when the app itself has failed. */
  onExit: () => void;
  children: ReactNode;
}

/**
 * If any screen throws, show this instead of a blank page: Quick Exit, Call 911 and the ComForce 24/7 line
 * stay reachable no matter what broke. Plain English on purpose: the translations live in the part that failed.
 */
export class CrashScreen extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ComForce app crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="view">
        <div className="ph-head">
          <div className="t">
            <span className="meta">ComForce MKE</span>
            <b>Something went wrong</b>
          </div>
          <button type="button" className="exit" onClick={this.props.onExit}>
            <Icon name="eyeoff" />
            Exit
          </button>
        </div>
        <div className="view-body ph-pad" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <p>The app hit a problem. If you need help now, call.</p>
          <a className="btn danger block" href="tel:911">
            <Icon name="phone" />
            Call 911
          </a>
          <a className="btn primary block" href={COMFORCE_HOTLINE.tel}>
            <Icon name="phone" />
            ComForce 24/7: {COMFORCE_HOTLINE.display}
          </a>
          <button type="button" className="btn block" onClick={() => window.location.reload()}>
            Start over
          </button>
        </div>
      </div>
    );
  }
}
