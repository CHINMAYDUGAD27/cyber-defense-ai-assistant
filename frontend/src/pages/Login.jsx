import { useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa'
import { MdSecurity } from 'react-icons/md'
import { API_BASE } from '../config/api'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true) // Fixed: Changed from loading(true) to setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password })
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('token', res.data.access_token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    }
    setLoading(false) // Fixed: Changed from loading(false) to setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0B0E14] text-[#E4E7EB] font-sans relative pb-16 md:pb-0">
      {/* Left Details Section with Hero Image Background */}
      <div
        className="md:w-1/2 flex flex-col justify-center p-12 lg:p-20 relative overflow-hidden"
        style={{
          backgroundImage: 'url(/cyber_mask.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark/Glass Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0E14]/95 via-[#0B0E14]/50 to-transparent z-0"></div>

        <div className="relative z-10 flex flex-col gap-8 max-w-xl mx-auto md:mx-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              AI Cyber Defense
            </h1>
            <p className="text-lg text-gray-300">
              Next-generation threat detection and intelligent security.
            </p>
          </div>

          <div className="space-y-6 mt-8">
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <MdSecurity className="text-3xl text-blue-400" />
                <h3 className="text-xl font-semibold text-white">What is Cybersecurity?</h3>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">
                Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks. These cyberattacks are usually aimed at accessing, changing, or destroying sensitive information, extorting money from users, or interrupting normal business processes.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <FaExclamationTriangle className="text-2xl text-orange-400" />
                <h3 className="text-xl font-semibold text-white">Current Challenges</h3>
              </div>
              <ul className="text-gray-400 space-y-2 text-sm list-disc list-inside">
                <li>Ransomware evolving with sophisticated extortion tactics</li>
                <li>Supply chain attacks compromising trusted third-party software</li>
                <li>AI-powered phishing and social engineering campaigns</li>
                <li>Cloud security misconfigurations and data breaches</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Form Section */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-[#0B0E14]">
        <div className="w-full max-w-md bg-[#141922] border border-[#232A36] p-10 rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-[#8B94A3]">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#8B94A3] mb-1">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0B0E14] border border-[#232A36] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3B9EFF] focus:ring-1 focus:ring-[#3B9EFF] transition-colors placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8B94A3] mb-1">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0B0E14] border border-[#232A36] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3B9EFF] focus:ring-1 focus:ring-[#3B9EFF] transition-colors placeholder:text-gray-600"
              />
            </div>

            {error && (
              <div className="bg-[#E5484D]/10 border border-[#E5484D]/50 text-[#E5484D] px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <FaExclamationTriangle />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3B9EFF] hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#8B94A3] mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#3B9EFF] hover:text-blue-400 font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Educational Disclaimer Footer */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full text-center text-xs text-gray-500 tracking-wide pointer-events-none px-4">
        <p>&copy; 2026 AI Cyber Defense. All rights reserved. This platform is for educational purposes only.</p>
      </footer>
    </div>
  )
}

export default Login