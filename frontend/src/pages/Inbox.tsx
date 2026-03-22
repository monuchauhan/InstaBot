import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { inboxApi } from '../services/api';
import { ConversationSummary, InboxMessage } from '../types';

type FilterType = 'all' | 'comments' | 'dms' | 'automated';

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalConversations, setTotalConversations] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);

  const [activeRecipient, setActiveRecipient] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await inboxApi.getConversations(
        1,
        50,
        filter === 'all' ? undefined : filter
      );
      setConversations(data.conversations);
      setTotalConversations(data.total);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const selectConversation = async (recipientId: string) => {
    setActiveRecipient(recipientId);
    setLoadingMessages(true);
    try {
      const data = await inboxApi.getMessages(recipientId);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const formatFullTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'comment_reply':
        return (
          <span className="text-[9px] uppercase tracking-wider font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
            Comment
          </span>
        );
      case 'dm_sent':
        return (
          <span className="text-[9px] uppercase tracking-wider font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
            DM Sent
          </span>
        );
      case 'dm_response':
        return (
          <span className="text-[9px] uppercase tracking-wider font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
            Reply
          </span>
        );
      default:
        return (
          <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
            {type.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const activeConvo = conversations.find(
    (c) => c.recipient_id === activeRecipient
  );

  return (
    <div className="flex flex-col h-screen">
      <TopBar searchPlaceholder="Search conversations..." />
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation List */}
        <section className="w-80 lg:w-96 bg-surface-container-low flex flex-col border-r border-transparent">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold tracking-tight font-headline">
                Messages
              </h2>
              <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {totalConversations} Total
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['all', 'comments', 'dms', 'automated'] as FilterType[]).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      filter === f
                        ? 'bg-white shadow-sm text-primary'
                        : 'text-slate-500 hover:text-on-surface'
                    }`}
                  >
                    {f === 'all'
                      ? 'All'
                      : f === 'dms'
                      ? 'DMs'
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 px-3 pb-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="loading-spinner" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <span className="material-symbols-outlined text-4xl text-outline mb-4">
                  chat_bubble_outline
                </span>
                <p className="text-sm font-bold text-on-surface">
                  No conversations yet
                </p>
                <p className="text-xs text-outline mt-1">
                  Messages from your Instagram automations will appear here.
                </p>
              </div>
            ) : (
              conversations.map((convo) => (
                <div
                  key={convo.recipient_id}
                  onClick={() => selectConversation(convo.recipient_id)}
                  className={`rounded-xl p-4 cursor-pointer transition-colors ${
                    activeRecipient === convo.recipient_id
                      ? 'bg-white shadow-sm border-l-4 border-primary'
                      : 'hover:bg-white/60'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                        {convo.recipient_id.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm truncate">
                          {convo.recipient_id}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {formatTime(convo.last_timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {convo.last_message || 'No message'}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {getActionBadge(convo.last_action_type)}
                        {convo.total_messages > 1 && (
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-surface-container-high text-slate-500 px-1.5 py-0.5 rounded">
                            {convo.total_messages} msgs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Center: Chat Window */}
        <section className="flex-1 flex flex-col bg-white">
          {!activeRecipient ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-surface-container-high mb-4">
                forum
              </span>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-1">
                Select a conversation
              </h3>
              <p className="text-sm text-on-surface-variant">
                Choose a conversation from the list to view messages.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-8 py-4 flex items-center justify-between bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                    {activeRecipient.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">
                      {activeRecipient}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {activeConvo?.total_messages ?? 0} messages
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-slate-500">
                      more_vert
                    </span>
                  </button>
                </div>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <div className="loading-spinner" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-on-surface-variant py-12">
                    No messages in this conversation.
                  </p>
                ) : (
                  <>
                    {/* Date Separator */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-surface-container" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Automation History
                      </span>
                      <div className="flex-1 h-px bg-surface-container" />
                    </div>

                    {messages.map((msg) => {
                      const isBot =
                        msg.action_type === 'dm_sent' ||
                        msg.action_type === 'comment_reply';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col gap-1 max-w-[80%] ${
                            isBot ? 'items-start' : 'items-end ml-auto'
                          }`}
                        >
                          {isBot && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="material-symbols-outlined text-blue-600 text-xs">
                                smart_toy
                              </span>
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                Automation Bot
                              </span>
                            </div>
                          )}
                          <div
                            className={`px-5 py-3 rounded-2xl font-medium text-sm leading-relaxed ${
                              isBot
                                ? 'bg-surface-container-low text-on-surface rounded-tl-none'
                                : 'bg-gradient-to-br from-primary to-primary-container text-white rounded-tr-none shadow-lg shadow-blue-500/10'
                            }`}
                          >
                            {msg.message || 'No content'}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400">
                              {formatFullTime(msg.created_at)}
                            </span>
                            {getActionBadge(msg.action_type)}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Input Area (read-only hint) */}
              <div className="p-6 border-t-0 bg-white">
                <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-xl">
                  <span className="material-symbols-outlined text-slate-400">
                    info
                  </span>
                  <p className="text-xs text-slate-500 flex-1">
                    This is an automation log view. Messages are sent
                    automatically by your configured flows.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right: User Details */}
        <section className="hidden xl:flex w-80 bg-surface-container-low flex-col overflow-y-auto">
          {activeRecipient && activeConvo ? (
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-xl shadow-slate-200">
                {activeRecipient.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="font-headline font-extrabold text-xl">
                {activeRecipient}
              </h3>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Instagram User
              </p>

              <div className="mt-6 flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-lg leading-none">
                    {activeConvo.total_messages}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Messages
                  </p>
                </div>
                <div className="w-px h-8 bg-surface-container-high" />
                <div className="text-center">
                  <p className="font-bold text-lg leading-none capitalize">
                    {activeConvo.last_status}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Status
                  </p>
                </div>
              </div>

              <div className="w-full mt-8 space-y-6 text-left">
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
                    Last Interaction
                  </h4>
                  <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Type</span>
                      <span className="text-xs text-primary font-bold capitalize">
                        {activeConvo.last_action_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">When</span>
                      <span className="text-xs text-slate-500">
                        {formatTime(activeConvo.last_timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
                    Last Message
                  </h4>
                  <p className="text-xs text-on-surface-variant bg-white p-4 rounded-xl shadow-sm line-clamp-4">
                    {activeConvo.last_message || 'No message'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-outline">
                User details will appear here
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Inbox;
