import { useEffect } from 'react'
import './App.css'

function App() {
  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist()
    }
  }, [])

  return (
    <main>
      <h1>Portable Electronic Health Record</h1>
      <p>Phase 1 scaffold is ready. Next step: Patient List + Add/Edit flow.</p>
    </main>
  )
}

export default App
