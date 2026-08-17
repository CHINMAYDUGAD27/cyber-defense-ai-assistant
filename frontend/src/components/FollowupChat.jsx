import { useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../config/api'

function FollowupChat({ incidentId }) {
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)

    const handleAsk = async () => {
        if (!question.trim()) return
        const currentQuestion = question
        setMessages((prev) => [...prev, { role: 'user', text: currentQuestion }])
        setQuestion('')
        setLoading(true)

        try {
            const token = localStorage.getItem('token')
            const res = await axios.post(
                `${API_BASE}/incidents/${incidentId}/ask`,
                { question: currentQuestion },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setMessages((prev) => [...prev, { role: 'assistant', text: res.data.answer }])
        } catch (err) {
            setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong answering that.' }])
        }
        setLoading(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleAsk()
        }
    }

    return (
        <div style={{
            marginTop: '1.5rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1.25rem'
        }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Ask a follow-up question</h3>

            {messages.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-main)',
                                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                                border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '0.6rem 0.9rem',
                                fontSize: '0.85rem',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap'
                            }}
                        >
                            {msg.text}
                        </div>
                    ))}
                    {loading && (
                        <div style={{
                            alignSelf: 'flex-start',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontStyle: 'italic'
                        }}>
                            Thinking...
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem' }}>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. What should I check first?"
                    style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.55rem 0.8rem',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '0.85rem'
                    }}
                />
                <button
                    onClick={handleAsk}
                    disabled={loading || !question.trim()}
                    style={{
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.55rem 1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    Ask
                </button>
            </div>
        </div>
    )
}

export default FollowupChat