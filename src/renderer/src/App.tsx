import { useState } from 'react'
import { ApplyTab } from './components/ApplyTab'
import { EventsTab } from './components/EventsTab'
import { MetadataTab } from './components/MetadataTab'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { useApp } from './state/AppContext'

export default function App(): React.JSX.Element {
  const { activeTab } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-bg flex h-full w-full overflow-hidden bg-canvas">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex min-w-0 flex-1 flex-col">
        {activeTab === 'events' ? <EventsTab /> : null}
        {activeTab === 'metadata' ? <MetadataTab /> : null}
        {activeTab === 'apply' ? <ApplyTab /> : null}
      </main>
      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
      <Toasts />
    </div>
  )
}
