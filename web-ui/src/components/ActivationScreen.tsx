import { useState, useEffect, useCallback, useRef } from 'react'
import { addCustomEventListener, emitEvent, isInJuceWebView } from '../lib/juce-bridge'

// Dev mode: skip real activation when running in browser (not in JUCE WebView)
const DEV_MODE = !isInJuceWebView()

// Test codes that bypass real activation (case insensitive)
const TEST_CODES = ['TEST', 'DEMO', 'BEATCONNECT', 'DEV']

interface ActivationInfo {
  activationCode: string
  machineId: string
  activatedAt: string
  currentActivations: number
  maxActivations: number
  isValid: boolean
}

interface ActivationState {
  isConfigured: boolean
  isActivated: boolean
  info?: ActivationInfo
}

interface ActivationResult {
  status: string
  info?: ActivationInfo
}

type ScreenState = 'checking' | 'input' | 'activating' | 'success' | 'error'

export function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const [screenState, setScreenState] = useState<ScreenState>('checking')
  const [licenseKey, setLicenseKey] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [activationInfo, setActivationInfo] = useState<ActivationInfo | null>(null)
  const [showContent, setShowContent] = useState(false)

  // Track if we're using a test code (ignore real API responses)
  const usingTestCode = useRef(false)

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Check activation status on mount
  useEffect(() => {
    // Dev mode: show input screen briefly
    if (DEV_MODE) {
      setTimeout(() => setScreenState('input'), 500)
      return
    }

    const unsubState = addCustomEventListener('activationState', (data: unknown) => {
      const state = data as ActivationState

      if (!state.isConfigured) {
        onActivated()
        return
      }

      if (state.isActivated && state.info?.isValid) {
        setActivationInfo(state.info)
        setScreenState('success')
        setTimeout(onActivated, 1500)
      } else {
        setScreenState('input')
      }
    })

    const unsubResult = addCustomEventListener('activationResult', (data: unknown) => {
      // Ignore API responses if we're using a test code
      if (usingTestCode.current) return

      const result = data as ActivationResult

      switch (result.status) {
        case 'valid':
        case 'already_active':
          setActivationInfo(result.info || null)
          setScreenState('success')
          setTimeout(onActivated, 1500)
          break
        case 'invalid':
          setErrorMessage('Invalid license key. Please check and try again.')
          setScreenState('error')
          break
        case 'revoked':
          setErrorMessage('This license has been revoked.')
          setScreenState('error')
          break
        case 'max_reached':
          setErrorMessage('Maximum activations reached. Deactivate another device first.')
          setScreenState('error')
          break
        case 'network_error':
          setErrorMessage('Network error. Please check your connection.')
          setScreenState('error')
          break
        case 'server_error':
          setErrorMessage('Server error. Please try again later.')
          setScreenState('error')
          break
        default:
          setErrorMessage('Activation failed. Please try again.')
          setScreenState('error')
      }
    })

    // Request current status
    emitEvent('getActivationStatus', {})

    return () => {
      unsubState()
      unsubResult()
    }
  }, [onActivated])

  const handleActivate = useCallback(() => {
    const code = licenseKey.trim()
    if (!code) return

    // Check for test codes FIRST (case insensitive, trim whitespace)
    const isTestCode = TEST_CODES.some(tc =>
      code.toUpperCase().replace(/[\s-]/g, '') === tc
    )

    if (DEV_MODE || isTestCode) {
      usingTestCode.current = true
      setScreenState('activating')
      setErrorMessage('')

      setTimeout(() => {
        setActivationInfo({
          activationCode: code,
          machineId: 'dev-machine',
          activatedAt: new Date().toISOString(),
          currentActivations: 1,
          maxActivations: 3,
          isValid: true
        })
        setScreenState('success')
        setTimeout(onActivated, 1500)
      }, 800)
      return
    }

    // Real activation
    usingTestCode.current = false
    setScreenState('activating')
    setErrorMessage('')
    emitEvent('activateLicense', { code })
  }, [licenseKey, onActivated])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleActivate()
    }
  }, [handleActivate])

  const handleRetry = useCallback(() => {
    setScreenState('input')
    setErrorMessage('')
    usingTestCode.current = false
  }, [])

  return (
    <div className={`activation-screen ${showContent ? 'visible' : ''}`}>
      {/* Animated background */}
      <div className="activation-bg">
        <div className="activation-glow glow-1" />
        <div className="activation-glow glow-2" />
        <div className="activation-glow glow-3" />
      </div>

      <div className="activation-content">
        {/* Logo - always in same position */}
        <div className="activation-logo">
          <h1 className="activation-title">DRIVE</h1>
          <div className="activation-subtitle">DRUM ANALOG PROCESSOR</div>
        </div>

        {/* State area - fixed height container */}
        <div className="activation-state-area">
          {/* Checking state */}
          {screenState === 'checking' && (
            <div className="activation-state-content">
              <div className="activation-spinner" />
              <p>Checking license...</p>
            </div>
          )}

          {/* Input state */}
          {screenState === 'input' && (
            <div className="activation-state-content">
              <p className="activation-prompt">Enter your license key to activate</p>
              <input
                type="text"
                className="activation-input"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck={false}
              />
              <button
                className="activation-button"
                onClick={handleActivate}
                disabled={!licenseKey.trim()}
              >
                Activate
              </button>
            </div>
          )}

          {/* Activating state */}
          {screenState === 'activating' && (
            <div className="activation-state-content">
              <div className="activation-spinner" />
              <p>Activating...</p>
            </div>
          )}

          {/* Success state */}
          {screenState === 'success' && (
            <div className="activation-state-content">
              <div className="activation-checkmark">
                <svg viewBox="0 0 52 52">
                  <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
              <p className="activation-success-text">Activated!</p>
              {activationInfo && (
                <p className="activation-info">
                  {activationInfo.currentActivations} of {activationInfo.maxActivations} activations used
                </p>
              )}
            </div>
          )}

          {/* Error state */}
          {screenState === 'error' && (
            <div className="activation-state-content">
              <div className="activation-error-icon">!</div>
              <p className="activation-error-text">{errorMessage}</p>
              <button className="activation-button secondary" onClick={handleRetry}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Version info */}
      <div className="activation-version">v1.0.0</div>
    </div>
  )
}
