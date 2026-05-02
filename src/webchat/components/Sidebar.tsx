/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

import type { Session } from "../lib/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({ sessions, activeSessionId, onSelectSession, onNewChat }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="sidebar-new-chat"
        onClick={onNewChat}
        type="button"
      >
        {browser.i18n.getMessage("copilot_new_chat")}
      </button>
      <ul className="sidebar-session-list">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`sidebar-session-item${session.id === activeSessionId ? " active" : ""}`}
            onClick={() => onSelectSession(session.id)}
            title={session.title}
          >
            <span className="sidebar-session-title">{session.title || browser.i18n.getMessage("copilot_untitled_session")}</span>
            <span className="sidebar-session-model">{session.model}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
