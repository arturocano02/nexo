"use client"

import { useState, useEffect, useRef } from "react"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import toast from "react-hot-toast"
import { trackChatEvent, trackError } from "@/src/lib/analytics"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  webResults?: { title: string; url: string; snippet: string }[]
}

interface ChatInterfaceProps {
  conversationId?: string
  onViewUpdate?: () => void
}

export default function ChatInterface({ conversationId, onViewUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load conversation and messages on mount
  useEffect(() => {
    loadOrCreateConversation()
  }, []) // Run only on mount

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages()
    }
  }, [currentConversationId])

  const loadOrCreateConversation = async () => {
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to chat")
        return
      }

      // Try to get existing conversation (most recent one)
      const { data: existingConvs } = await supa
        .from("conversations")
        .select("id")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (existingConvs && existingConvs.length > 0) {
        const existingConv = existingConvs[0]
        setCurrentConversationId(existingConv.id)
        // Load messages for the existing conversation
        await loadMessagesForConversation(existingConv.id)
        return
      }

      // Create new conversation if none exists
      const { data: newConv, error: newConvError } = await supa
        .from("conversations")
        .insert({
          user_id: session.user.id,
          title: "Political Discussion"
        })
        .select("id")
        .single()

      if (newConvError) {
        throw newConvError
      }

      setCurrentConversationId(newConv.id)
      // Load messages for the new conversation (will be empty initially)
      await loadMessagesForConversation(newConv.id)
    } catch (error) {
      console.error("Error loading conversation:", error)
      toast.error("Failed to load conversation")
    }
  }

  const loadMessages = async () => {
    if (!currentConversationId) return
    await loadMessagesForConversation(currentConversationId)
  }

  const loadMessagesForConversation = async (conversationId: string) => {
    try {
      const supa = supabaseBrowser()
      const { data, error } = await supa
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error loading messages:", error)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    const userMessage = input.trim()
    setInput("")
    setSending(true)

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to chat")
        return
      }

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
      }

      const result = await response.json()
      
      // Update conversation ID if this was a new conversation
      if (result.conversationId && !currentConversationId) {
        setCurrentConversationId(result.conversationId)
      }

      // Reload messages to get the real ones from the database in correct order
      await loadMessages()

      // Track successful message send
      trackChatEvent('CHAT_MESSAGE_SENT', 'success')
      
      // Trigger view update if callback provided
      if (onViewUpdate) {
        onViewUpdate()
      }

    } catch (error: any) {
      console.error("Send message error:", error)
      trackError('chat_message_failed', error.message)
      toast.error(error.message || "Failed to send message")
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-neutral-500 text-sm mb-2">Start a conversation</div>
            <div className="text-xs text-neutral-400">
              Ask me anything about UK politics or current events
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-900"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                
                {/* Web search results */}
                {message.webResults && message.webResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-neutral-600">Sources:</div>
                    {message.webResults.map((result, index) => (
                      <div key={index} className="text-xs">
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {result.title}
                        </a>
                        <div className="text-neutral-500 mt-1">{result.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={`text-xs mt-1 ${
                  message.role === "user" ? "text-neutral-300" : "text-neutral-500"
                }`}>
                  {formatTime(message.created_at)}
                </div>
                
                {/* Background timestamp for better context */}
                <div className={`text-xs opacity-30 ${
                  message.role === "user" ? "text-neutral-300" : "text-neutral-400"
                }`}>
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
        
        {sending && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 text-neutral-900 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-neutral-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-neutral-200 p-4">
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's on your mind about UK politics?"
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            disabled={sending}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="h-12 w-12 rounded-xl bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors flex items-center justify-center"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        <div className="text-xs text-neutral-500 mt-2 text-center">
          {input.length}/1000 characters
        </div>
      </div>
    </div>
  )
}
