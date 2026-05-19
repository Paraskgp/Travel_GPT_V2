'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
          <p className="text-stone-500 text-sm font-medium">Map unavailable</p>
          <p className="text-stone-400 text-xs max-w-xs">
            Enable the <strong>Maps JavaScript API</strong> in Google Cloud Console for this API key, then reload.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
