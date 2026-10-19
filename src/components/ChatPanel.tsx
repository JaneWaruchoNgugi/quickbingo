import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useGame } from '../hooks/useGame'

export function ChatPanel() {
  const g = useGame()
  const log = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')

  useLayoutEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [g.chatLog.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (v) {
      g.say('You', v)
      setText('')
    }
  }

  return (
    <div className="gp chatp">
      <div className="pt">Live Chat</div>
      <div className="chat" ref={log} aria-live="polite">
        {g.chatLog.map(m => (
          <p key={m.id}>
            <b>{m.who}</b> <span>{m.msg}</span>
          </p>
        ))}
      </div>
      <form className="chat-in" onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" autoComplete="off" />
        <button className="ghost" type="submit">
          Send
        </button>
      </form>
    </div>
  )
}
