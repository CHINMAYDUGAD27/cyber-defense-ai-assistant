import React, { useState } from 'react'
import { FiShield, FiAlertTriangle, FiLock, FiEye, FiPlayCircle, FiExternalLink } from 'react-icons/fi'
import { MdSecurity, MdOutlinePhishing } from 'react-icons/md'

const VIDEOS = [
  {
    id: 'ooJSgsB5fIE',
    title: 'What is Cyber Security?',
    subtitle: 'Introduction to Cyber Security Training',
    channel: 'Edureka',
    duration: '~8 min',
    tag: 'Beginner',
    tagColor: '#22c55e',
    description: 'Learn the fundamentals of cybersecurity — what it is, why it matters, and how to protect yourself and your organisation from modern threats.',
  },
  {
    id: 'inWWhr5tnEA',
    title: 'Cyber Security In 7 Minutes',
    subtitle: 'How It Works — Full Explainer',
    channel: 'Simplilearn',
    duration: '~7 min',
    tag: 'Essential',
    tagColor: '#f59e0b',
    description: 'A concise yet comprehensive walkthrough of how cyber threats work, covering phishing, malware, social engineering, and best-practice defences.',
  },
  {
    id: 'ULGILG-ZhO0',
    title: 'Introduction to Cybersecurity',
    subtitle: 'Fundamental Concepts',
    channel: 'Simplilearn',
    duration: '~5 min',
    tag: 'Critical',
    tagColor: '#ef4444',
    description: 'A deeper dive into the core concepts of information security and how attackers exploit vulnerabilities in everyday systems.',
  },
]

const TIPS = [
  { icon: <FiLock />, color: '#6366f1', title: 'Use Strong Passwords', text: 'Use at least 12 characters mixing letters, numbers, and symbols. Never reuse passwords across sites.' },
  { icon: <MdOutlinePhishing />, color: '#f59e0b', title: 'Spot Phishing Emails', text: 'Be suspicious of urgent language, misspelled domains, and unexpected attachments. Verify before clicking.' },
  { icon: <FiShield />, color: '#22c55e', title: 'Enable MFA', text: 'Multi-factor authentication blocks 99% of automated account takeover attacks. Turn it on everywhere.' },
  { icon: <FiEye />, color: '#ef4444', title: 'Never Share OTPs', text: 'Legitimate banks and services will NEVER ask for your OTP, PIN, or password over call, SMS, or email.' },
]

function VideoCard({ video, isActive, onPlay }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-panel)',
      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-color)',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'all 0.25s',
      transform: isActive ? 'translateY(-3px)' : 'none',
      boxShadow: isActive ? '0 8px 32px rgba(99,102,241,0.18)' : 'none',
      cursor: 'pointer',
      flex: '1 1 280px',
      minWidth: '280px',
    }} onClick={() => onPlay(video.id)}>
      {/* Thumbnail placeholder with play overlay */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', backgroundColor: '#0f1117', overflow: 'hidden' }}>
        <img
          src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
          alt={video.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
        />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.3)',
            transition: 'transform 0.15s',
          }}>
            <FiPlayCircle style={{ fontSize: '1.8rem', color: '#fff' }} />
          </div>
        </div>
        <span style={{
          position: 'absolute', bottom: '8px', right: '8px',
          backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff',
          fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px',
          borderRadius: '4px',
        }}>{video.duration}</span>
        <span style={{
          position: 'absolute', top: '8px', left: '8px',
          backgroundColor: video.tagColor + 'cc',
          color: '#fff', fontSize: '0.7rem', fontWeight: 700,
          padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.05em',
        }}>{video.tag}</span>
      </div>

      {/* Info */}
      <div style={{ padding: '1rem 1.1rem 1.2rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 500 }}>
          {video.channel}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem', lineHeight: 1.35 }}>
          {video.title}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {video.description}
        </div>
      </div>
    </div>
  )
}

function TipCard({ tip }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        backgroundColor: tip.color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.1rem', color: tip.color, flexShrink: 0,
      }}>
        {tip.icon}
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          {tip.title}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {tip.text}
        </div>
      </div>
    </div>
  )
}

function Awareness() {
  const [activeVideoId, setActiveVideoId] = useState(null)

  const handlePlay = (id) => {
    setActiveVideoId(id === activeVideoId ? null : id)
  }

  const activeVideo = VIDEOS.find(v => v.id === activeVideoId)

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <MdSecurity style={{ fontSize: '1.6rem', color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Cyber Awareness Hub
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
          Watch these short videos to stay protected against today's most common cyber threats.
        </p>
      </div>

      {/* Alert banner */}
      <div style={{
        backgroundColor: '#ef444415',
        border: '1px solid #ef444444',
        borderRadius: '10px',
        padding: '0.9rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        <FiAlertTriangle style={{ color: '#ef4444', fontSize: '1.2rem', flexShrink: 0 }} />
        <span style={{ color: '#ef4444', fontSize: '0.87rem', fontWeight: 500 }}>
          <strong>Did you know?</strong> 95% of cybersecurity breaches are caused by human error.
          Awareness is your strongest defence — watch the videos below to stay one step ahead.
        </span>
      </div>

      {/* Video player (when active) */}
      {activeVideoId && (
        <div style={{
          marginBottom: '2rem',
          borderRadius: '14px', overflow: 'hidden',
          border: '1px solid var(--accent)',
          boxShadow: '0 8px 40px rgba(99,102,241,0.2)',
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{ background: '#0f1117', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{activeVideo?.title}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginLeft: '0.75rem' }}>
                {activeVideo?.channel}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <a href={`https://www.youtube.com/watch?v=${activeVideoId}`} target="_blank" rel="noreferrer"
                style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', textDecoration: 'none' }}>
                <FiExternalLink /> Open on YouTube
              </a>
              <button onClick={() => setActiveVideoId(null)} style={{
                background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                borderRadius: '6px', padding: '0.2rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem',
              }}>✕ Close</button>
            </div>
          </div>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0`}
              title={activeVideo?.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Video cards */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
        {VIDEOS.map(v => (
          <VideoCard
            key={v.id}
            video={v}
            isActive={activeVideoId === v.id}
            onPlay={handlePlay}
          />
        ))}
      </div>

      {/* Quick Tips */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          🛡️ Quick Security Tips
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.9rem' }}>
          {TIPS.map((tip, i) => <TipCard key={i} tip={tip} />)}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}

export default Awareness
