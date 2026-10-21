import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/game';

interface TacticalChatDockProps {
  onAddToast?: (msg: string) => void;
  lastCombatEvent?: string | null;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  // World Channel
  {
    id: 'w1',
    channel: 'world',
    sender: 'Lord Arjun',
    tag: 'GORK',
    avatar: '👑',
    text: 'Scouts spotted an Ancient Treant Guardian near the eastern foothills. High timber bounty!',
    timestamp: '11:32',
  },
  {
    id: 'w2',
    channel: 'world',
    sender: 'Lady Sumnima',
    tag: 'KIRAT',
    avatar: '🏹',
    text: 'Level 4 Stone Crystal deposits discovered in mountain pass. Watch out for frost wolves.',
    timestamp: '11:34',
  },
  {
    id: 'w3',
    channel: 'world',
    sender: 'Kingdom Herald',
    tag: 'SYSTEM',
    avatar: '📜',
    text: '☀️ Clear weather over Gorkha Valley. Army march velocity is at peak efficiency.',
    timestamp: '11:35',
    isSystem: true,
  },
  {
    id: 'w4',
    channel: 'world',
    sender: 'Baron Kaji',
    tag: 'IRON',
    avatar: '⚔️',
    text: 'Any commanders ready to rally against the Level 5 Snow Bear in the north?',
    timestamp: '11:38',
  },

  // Alliance Channel
  {
    id: 'a1',
    channel: 'alliance',
    sender: 'Vanguard Khem',
    tag: 'MAGAR',
    avatar: '🛡️',
    text: 'Citadel fortress perimeter secure. Wheat farms level 3 yielding steady surplus.',
    timestamp: '11:30',
  },
  {
    id: 'a2',
    channel: 'alliance',
    sender: 'Commander Tara',
    tag: 'MAGAR',
    avatar: '🗡️',
    text: 'Citadel war barracks training cavalry. Remember to dispatch archers against tree monsters!',
    timestamp: '11:36',
  },
  {
    id: 'a3',
    channel: 'alliance',
    sender: 'Quartermaster Bir',
    tag: 'MAGAR',
    avatar: '📦',
    text: 'Gold reserves ready for citadel upgrade. Ping if you need escort to the gold seams.',
    timestamp: '11:39',
  },
];

export const TacticalChatDock: React.FC<TacticalChatDockProps> = ({ lastCombatEvent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'world' | 'alliance'>('world');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<{ world: number; alliance: number }>({ world: 0, alliance: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message in active tab
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isOpen]);

  // Handle incoming combat events into alliance chat
  useEffect(() => {
    if (lastCombatEvent) {
      const newMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        channel: 'alliance',
        sender: 'Citadel War Room',
        tag: 'MAGAR',
        avatar: '⚔️',
        text: lastCombatEvent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
      };

      setMessages((prev) => [...prev, newMsg]);

      if (!isOpen || activeTab !== 'alliance') {
        setUnreadCounts((u) => ({ ...u, alliance: u.alliance + 1 }));
      }
    }
  }, [lastCombatEvent]);

  const handleTabSwitch = (tab: 'world' | 'alliance') => {
    setActiveTab(tab);
    setUnreadCounts((u) => ({ ...u, [tab]: 0 }));
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      channel: activeTab,
      sender: 'Commander (You)',
      tag: 'MAGAR',
      avatar: '🎖️',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isPlayer: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    // Simulated responsive alliance/world reply
    setTimeout(() => {
      let replyText = '';
      let replySender = '';
      let replyTag = '';
      let replyAvatar = '🛡️';

      if (activeTab === 'alliance') {
        const allianceReplies = [
          'Understood, Commander! Vanguard units are ready to support your flank.',
          'Copy that! Gathering wagons are en route to secure the harvest.',
          'Citadel archers stand by your order!',
          'Great tactics, Commander. May the Magar banner fly high!',
        ];
        replyText = allianceReplies[Math.floor(Math.random() * allianceReplies.length)];
        replySender = 'Captain Ram';
        replyTag = 'MAGAR';
        replyAvatar = '🛡️';
      } else {
        const worldReplies = [
          'Safe travels across the Himalayan pass, Commander.',
          'Beware the Level 5 Frost Wolves prowling north of the river.',
          'Trading lumber for stone at eastern outpost if anyone is interested.',
          'Noted! Keep our borders defended.',
        ];
        replyText = worldReplies[Math.floor(Math.random() * worldReplies.length)];
        replySender = 'Lord Bikram';
        replyTag = 'KHAS';
        replyAvatar = '🐎';
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        channel: activeTab,
        sender: replySender,
        tag: replyTag,
        avatar: replyAvatar,
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredMessages = messages.filter((m) => m.channel === activeTab);
  const totalUnread = unreadCounts.world + unreadCounts.alliance;
  const latestMessage = messages[messages.length - 1];

  return (
    <>
      {/* 3D TACTICAL CHAT OPTION ICON BUTTON (BOTTOM-LEFT DOCK) */}
      <div className="tactical-3d-dock bottom-left">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setUnreadCounts((u) => ({ ...u, [activeTab]: 0 }));
            }
          }}
          className={`btn-3d-tactical ${isOpen ? 'active' : ''}`}
          title="Toggle Tactical World & Alliance Chat"
        >
          {/* 3D Chat Icon Housing */}
          <div className="icon-3d-chat-wrap">
            <span className="icon-3d-chat-balloon">💬</span>
          </div>

          <div className="btn-3d-label">
            <span className="btn-3d-title">
              {activeTab === 'world' ? 'World Chat' : 'Alliance Chat'}
            </span>
            <span className="btn-3d-sub">
              {latestMessage ? `${latestMessage.sender.slice(0, 10)}: ${latestMessage.text.slice(0, 16)}...` : 'Tactical Comms'}
            </span>
          </div>

          {totalUnread > 0 && <span className="btn-3d-badge">{totalUnread}</span>}
        </button>
      </div>

      {/* DOCKED TACTICAL CHAT WINDOW (NEVER FULLSCREEN - ALWAYS BOUND TO CORNER) */}
      {isOpen && (
        <div className="tactical-chat-window">
          {/* Header Bar & Dual Tabs */}
          <div className="tactical-chat-header">
            <div className="tactical-chat-tabs">
              <button
                type="button"
                onClick={() => handleTabSwitch('world')}
                className={`tactical-chat-tab-btn ${activeTab === 'world' ? 'active' : ''}`}
              >
                <span>🌐</span>
                <span>World</span>
                {unreadCounts.world > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: '4px', fontSize: '8px' }}>
                    {unreadCounts.world}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('alliance')}
                className={`tactical-chat-tab-btn ${activeTab === 'alliance' ? 'active' : ''}`}
              >
                <span>🛡️</span>
                <span>Alliance</span>
                {unreadCounts.alliance > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: '4px', fontSize: '8px' }}>
                    {unreadCounts.alliance}
                  </span>
                )}
              </button>
            </div>

            <div className="tactical-chat-ctrls">
              <button
                type="button"
                className="btn-chat-ctrl"
                onClick={() => setIsOpen(false)}
                title="Minimize Chat"
              >
                _
              </button>
              <button
                type="button"
                className="btn-chat-ctrl"
                onClick={() => setIsOpen(false)}
                title="Close Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="tactical-chat-messages">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.isPlayer ? 'player' : ''} ${msg.isSystem ? 'system' : ''}`}
              >
                <div className="chat-bubble-header">
                  <span>{msg.avatar || (msg.isPlayer ? '🎖️' : '🛡️')}</span>
                  <span className="chat-sender-name">{msg.sender}</span>
                  {msg.tag && (
                    <span className={`chat-tag-pill ${msg.tag === 'MAGAR' ? 'gold' : ''}`}>
                      [{msg.tag}]
                    </span>
                  )}
                  <span className="chat-timestamp">{msg.timestamp}</span>
                </div>
                <div className="chat-body-text">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Broadcast Chips */}
          <div className="tactical-chat-quick-chips">
            <button
              type="button"
              className="chat-chip-btn"
              onClick={() => handleSendMessage('⚔️ Rallying all vanguards for assault!')}
            >
              ⚔️ Rally
            </button>
            <button
              type="button"
              className="chat-chip-btn"
              onClick={() => handleSendMessage('🛡️ Defend Citadel gates!')}
            >
              🛡️ Defend
            </button>
            <button
              type="button"
              className="chat-chip-btn"
              onClick={() => handleSendMessage('🌲 Gathering timber at eastern grove.')}
            >
              🌲 Timber
            </button>
            <button
              type="button"
              className="chat-chip-btn"
              onClick={() => handleSendMessage('💎 Harvesting high-yield stone crystals.')}
            >
              💎 Crystals
            </button>
          </div>

          {/* Chat Input Bar */}
          <div className="tactical-chat-input-row">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === 'world' ? 'Broadcast to Realm...' : 'Message Alliance commanders...'}
              className="chat-text-input"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className="btn-chat-send"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};
