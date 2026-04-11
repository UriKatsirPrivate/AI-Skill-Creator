import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, Loader2, Bot, User, AlertTriangle, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onReset: () => void;
}

export function ChatPanel({ messages, isLoading, onSendMessage, onReset }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col bg-zinc-950 h-full">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Bot className="text-blue-500" />
            AI Skill Creator
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Describe your use case to generate a skill.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onReset}
            disabled={isLoading}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            title="Start Over"
          >
            <RotateCcw size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 mt-10">
            <p>No messages yet. Start by describing what you want your AI Skill to do.</p>
            <p className="text-xs mt-2">Example: "I want a skill that analyzes log files and finds errors."</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-blue-600 text-white" : "bg-zinc-800 text-blue-400"
              )}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-sm" 
                  : "bg-zinc-800 text-zinc-200 rounded-tl-sm"
              )}>
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    
                    {msg.validationWarnings && msg.validationWarnings.length > 0 && (
                      <div className="mt-4 bg-yellow-900/30 border border-yellow-700/50 rounded-md p-3 text-yellow-200 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-yellow-500 mb-2">
                          <AlertTriangle size={14} />
                          <span>Validation Warnings</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                          {msg.validationWarnings.map((warning, idx) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-yellow-400/80 italic">You can ask me to fix these issues!</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 text-blue-400 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-sm text-zinc-400">Generating skill artifacts...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your skill use case..."
            disabled={isLoading}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
