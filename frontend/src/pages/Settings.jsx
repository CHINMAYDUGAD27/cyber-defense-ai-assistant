import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../config/api'
import { FiBell, FiMoon, FiSun, FiSave, FiCheckCircle, FiKey, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.85rem 1rem',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</p>
        {description && (
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px',
          borderRadius: '999px',
          backgroundColor: checked ? 'var(--accent)' : 'var(--border-color)',
          border: 'none', cursor: 'pointer',
          position: 'relative', flexShrink: 0,
          transition: 'background-color 0.2s',
        }}
      >
        <div style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '23px' : '3px',
          width: '18px', height: '18px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  )
}

function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [showKey, setShowKey] = useState(false)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    axios.get(`${API_BASE}/settings`, { headers })
      .then(res => { setSettings(res.data); setLoading(false) })
      .catch(() => { setError('Could not load settings.'); setLoading(false) })
  }, [])

  const save = async () => {
    try {
      await axios.put(`${API_BASE}/settings`, settings, { headers })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

      // Apply theme immediately and save to localStorage
      if (settings.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
        localStorage.setItem('theme', 'light')
      } else {
        document.documentElement.removeAttribute('data-theme')
        localStorage.setItem('theme', 'dark')
      }
    } catch {
      setError('Could not save settings.')
    }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  return (
    <div style={{ padding: '2rem', maxWidth: '560px' }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--risk-critical)' }}>{error}</p>}

      {settings && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Phase 4: API Configuration */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FiKey style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>API Configuration</h2>
            </div>
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1.25rem',
            }}>
              {!settings.groq_api_key && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                  backgroundColor: 'var(--risk-medium)15',
                  border: '1px solid var(--risk-medium)40',
                  color: 'var(--text-primary)',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                }}>
                  <FiAlertCircle style={{ color: 'var(--risk-medium)', fontSize: '1.2rem', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>API Key Required:</strong> AI analysis will not work until a valid Groq API key is configured.
                  </div>
                </div>
              )}
              
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Groq API Key
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {settings.groq_api_key && settings.groq_api_key.includes('****') ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
                    <div style={{
                      flex: 1, padding: '0.65rem 1rem', backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'monospace'
                    }}>
                      {settings.groq_api_key}
                    </div>
                    <button
                      onClick={() => update('groq_api_key', '')}
                      style={{
                        padding: '0.65rem 1rem', background: 'none', border: '1px solid var(--border-color)',
                        borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem'
                      }}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      name="groq-api-key"
                      id="groq-api-key"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={settings.groq_api_key || ''}
                      onChange={e => update('groq_api_key', e.target.value)}
                      placeholder="gsk_..."
                      style={{
                        width: '100%',
                        padding: '0.65rem 1rem',
                        paddingRight: '2.5rem',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      title={showKey ? "Hide key" : "Show key"}
                      style={{
                        position: 'absolute', right: '0.5rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        padding: '4px',
                      }}
                    >
                      {showKey ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                )}
              </div>
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Your key is stored securely and never displayed in plain text after saving.
              </p>
            </div>
          </div>

          {/* Notification Preferences */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FiBell style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notification preferences</h2>
            </div>
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <Toggle
                checked={settings.notify_critical}
                onChange={v => update('notify_critical', v)}
                label="Critical incidents"
                description="Alert when risk level is Critical"
              />
              <Toggle
                checked={settings.notify_high}
                onChange={v => update('notify_high', v)}
                label="High incidents"
                description="Alert when risk level is High"
              />
              <Toggle
                checked={settings.notify_medium}
                onChange={v => update('notify_medium', v)}
                label="Medium incidents"
                description="Alert when risk level is Medium"
              />
              <Toggle
                checked={settings.notify_low}
                onChange={v => update('notify_low', v)}
                label="Low incidents"
                description="Alert when risk level is Low (off by default)"
              />
            </div>
          </div>

          {/* Theme */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {settings.theme === 'dark' ? (
                <FiMoon style={{ color: 'var(--accent)' }} />
              ) : (
                <FiSun style={{ color: '#D4A72C' }} />
              )}
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Appearance</h2>
            </div>
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', padding: '1rem', gap: '0.75rem' }}>
                {['dark', 'light'].map(t => (
                  <button
                    key={t}
                    onClick={() => update('theme', t)}
                    style={{
                      flex: 1,
                      padding: '0.7rem',
                      borderRadius: '6px',
                      border: settings.theme === t
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border-color)',
                      backgroundColor: settings.theme === t ? 'var(--accent)18' : 'var(--bg-main)',
                      color: settings.theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}
                  >
                    {t === 'dark' ? <FiMoon /> : <FiSun />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={save}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: 'var(--accent)',
                border: 'none', borderRadius: '7px',
                color: '#fff', padding: '0.6rem 1.2rem',
                fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              }}
            >
              <FiSave /> Save settings
            </button>
            {saved && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                color: 'var(--risk-low)', fontSize: '0.85rem',
                animation: 'fadeIn 0.2s ease',
              }}>
                <FiCheckCircle /> Saved!
              </span>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}

export default Settings
