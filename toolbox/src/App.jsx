import {
  ArrowUpFromLine,
  Download,
  FileText,
  Merge,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'

const files = [
  { name: 'project-overview.pdf', size: '2.4 MB', color: 'blue' },
  { name: 'contract-final.pdf', size: '1.8 MB', color: 'sky' },
  { name: 'client-notes.pdf', size: '980 KB', color: 'slate' },
]

const stats = [
  { label: 'Files merged', value: '12' },
  { label: 'Avg. speed', value: '2.1x' },
  { label: 'Secure', value: '100%' },
]

function App() {
  return (
    <div className="pdf-app-shell">
      <div className="pdf-app">
        <aside className="sidebar">
          <div className="brand-wrap">
            <div className="brand-mark">
              <FileText size={20} />
            </div>
            <div>
              <p className="eyebrow">Toolbox</p>
              <h2>PDF Merger</h2>
            </div>
          </div>

          <nav className="side-nav" aria-label="Main navigation">
            <button className="nav-item active">
              <Merge size={18} />
              Merge files
            </button>
            <button className="nav-item">
              <UploadCloud size={18} />
              Upload PDFs
            </button>
            <button className="nav-item">
              <ShieldCheck size={18} />
              Secure mode
            </button>
          </nav>

          <div className="mini-card">
            <Sparkles size={18} />
            <div>
              <strong>Fast merging</strong>
              <span>Keep the order, preserve quality.</span>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow accent">Document studio</p>
              <h1>Merge multiple PDFs</h1>
            </div>
            <button className="primary-btn">
              <ArrowUpFromLine size={18} />
              Upload files
            </button>
          </header>

          <section className="stats-grid" aria-label="pdf stats">
            {stats.map((item) => (
              <div key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </section>

          <section className="upload-panel">
            <div className="upload-copy">
              <div className="upload-icon">
                <UploadCloud size={22} />
              </div>
              <div>
                <h3>Drop your PDFs here</h3>
                <p>Supports bulk uploads and instant merging</p>
              </div>
            </div>
            <button className="secondary-btn">Choose files</button>
          </section>

          <section className="file-list" aria-label="pdf file list">
            <div className="list-header">
              <h3>Selected files</h3>
              <span>3 documents</span>
            </div>

            {files.map((file) => (
              <div key={file.name} className="file-row">
                <div className="file-meta">
                  <div className={`file-icon ${file.color}`}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>{file.name}</strong>
                    <span>{file.size}</span>
                  </div>
                </div>

                <div className="file-actions">
                  <button className="icon-btn" aria-label={`Download ${file.name}`}>
                    <Download size={16} />
                  </button>
                  <button className="icon-btn danger" aria-label={`Remove ${file.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App