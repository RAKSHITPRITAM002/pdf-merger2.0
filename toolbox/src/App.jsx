import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  FileImage,
  FileSpreadsheet,
  FileText,
  Image,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import './App.css'

const tools = [
  {
    id: 'image-to-pdf',
    title: 'Images to PDF',
    description: 'Combine JPG or PNG images into one PDF.',
    detail: 'Add one or more JPG or PNG images. Each image becomes a page in the PDF.',
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    extensions: ['jpg', 'jpeg', 'png'],
    icon: Image,
  },
  {
    id: 'pdf-to-image',
    title: 'PDF to images',
    description: 'Export PDF pages as PNG images.',
    detail: 'Add one or more PDFs. Every page is rendered as a downloadable PNG.',
    accept: '.pdf,application/pdf',
    extensions: ['pdf'],
    icon: FileImage,
  },
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    description: 'Extract selectable PDF text into a spreadsheet.',
    detail: 'Text is organized into rows and columns based on its position on each page.',
    accept: '.pdf,application/pdf',
    extensions: ['pdf'],
    icon: FileSpreadsheet,
  },
]

function getExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getPdfRows(items) {
  const lines = []

  for (const item of items) {
    if (!item.str?.trim()) continue

    const baseline = item.transform?.[5] ?? 0
    let line = lines.find((candidate) => Math.abs(candidate.baseline - baseline) < 3)

    if (!line) {
      line = { baseline, items: [] }
      lines.push(line)
    }

    line.items.push(item)
  }

  return lines
    .sort((a, b) => b.baseline - a.baseline)
    .map((line) => {
      const cells = []
      let previousEnd = null

      for (const item of line.items.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = item.transform[4] ?? 0
        const text = item.str.trim()

        if (previousEnd === null || x - previousEnd > 18) {
          cells.push(text)
        } else {
          cells[cells.length - 1] += ` ${text}`
        }

        previousEnd = x + (item.width || text.length * 4)
      }

      return cells
    })
    .filter((row) => row.length > 0)
}

function makeSheetName(fileName, existingNames, index) {
  const baseName = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim()
    .slice(0, 31) || `Document ${index + 1}`
  let name = baseName
  let suffix = 2

  while (existingNames.has(name)) {
    const suffixText = ` ${suffix}`
    name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`
    suffix += 1
  }

  existingNames.add(name)
  return name
}

async function openPdf(data) {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = workerUrl
  return getDocument({ data }).promise
}

function App() {
  const [activeToolId, setActiveToolId] = useState(tools[0].id)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [outputs, setOutputs] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef(null)
  const outputUrlsRef = useRef([])
  const activeTool = tools.find((tool) => tool.id === activeToolId)

  const clearOutputs = () => {
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    outputUrlsRef.current = []
    setOutputs([])
  }

  useEffect(() => () => {
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const resetToolData = () => {
    setSelectedFiles([])
    setError('')
    setNotice('')
    clearOutputs()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectTool = (toolId) => {
    if (toolId === activeToolId) return
    setActiveToolId(toolId)
    resetToolData()
  }

  const addFiles = (fileList) => {
    const allFiles = Array.from(fileList ?? [])
    const acceptedFiles = allFiles.filter((file) =>
      activeTool.extensions.includes(getExtension(file.name)),
    )
    const rejectedCount = allFiles.length - acceptedFiles.length

    if (acceptedFiles.length === 0) {
      if (allFiles.length > 0) {
        setError(`Choose ${activeTool.extensions.map((extension) => `.${extension}`).join(', ')} files for this tool.`)
      }
      return
    }

    setSelectedFiles((currentFiles) => [...currentFiles, ...acceptedFiles])
    setError('')
    setNotice(rejectedCount ? `${rejectedCount} unsupported file${rejectedCount > 1 ? 's were' : ' was'} skipped.` : '')
    clearOutputs()
  }

  const removeFile = (fileToRemove) => {
    setSelectedFiles((currentFiles) => currentFiles.filter((file) => file !== fileToRemove))
    setError('')
    setNotice('')
    clearOutputs()
  }

  const createPdfFromImages = async () => {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.create()

    for (const file of selectedFiles) {
      const bytes = await file.arrayBuffer()
      const image = getExtension(file.name) === 'png'
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes)
      const page = pdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }

    const pdfBytes = await pdf.save()
    return [{
      name: 'images.pdf',
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      previewType: 'pdf',
    }]
  }

  const createImagesFromPdfs = async () => {
    const imageOutputs = []

    for (const file of selectedFiles) {
      const pdf = await openPdf(new Uint8Array(await file.arrayBuffer()))
      const baseName = file.name.replace(/\.pdf$/i, '')

      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')

          if (!context) throw new Error('Your browser could not create an image canvas.')

          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, canvasContext: context, viewport }).promise
          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
              if (result) resolve(result)
              else reject(new Error('A PDF page could not be exported as an image.'))
            }, 'image/png')
          })
          imageOutputs.push({
            name: `${baseName}-page-${pageNumber}.png`,
            blob,
            previewType: 'image',
          })
          page.cleanup()
          canvas.width = 0
          canvas.height = 0
        }
      } finally {
        await pdf.destroy()
      }
    }

    return imageOutputs
  }

  const createExcelFromPdfs = async () => {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const existingNames = new Set()
    const scannedFiles = []
    let extractedRows = 0

    for (const [fileIndex, file] of selectedFiles.entries()) {
      const pdf = await openPdf(new Uint8Array(await file.arrayBuffer()))

      try {
        const sheet = workbook.addWorksheet(makeSheetName(file.name, existingNames, fileIndex))
        let fileRows = 0

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const text = await page.getTextContent()
          const rows = getPdfRows(text.items)

          if (rows.length > 0) {
            rows.forEach((row) => sheet.addRow(row))
            fileRows += rows.length
          }

          if (pageNumber < pdf.numPages && rows.length > 0) sheet.addRow([])
        }

        if (fileRows === 0) {
          workbook.removeWorksheet(sheet.id)
          scannedFiles.push(file.name)
        } else {
          extractedRows += fileRows
          sheet.eachRow((row) => {
            row.eachCell((cell) => {
              cell.alignment = { vertical: 'top', wrapText: true }
            })
          })
        }
      } finally {
        await pdf.destroy()
      }
    }

    if (scannedFiles.length > 0) {
      throw new Error(
        `No selectable text was found in ${scannedFiles.join(', ')}. Scanned PDFs need OCR, which this tool does not include.`,
      )
    }

    if (extractedRows === 0) {
      throw new Error('No selectable text was found in the selected PDFs.')
    }

    const workbookBytes = await workbook.xlsx.writeBuffer()
    return [{
      name: 'converted-data.xlsx',
      blob: new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      previewType: 'spreadsheet',
    }]
  }

  const convertFiles = async () => {
    if (selectedFiles.length === 0 || isProcessing) return

    setIsProcessing(true)
    setError('')
    setNotice('')
    clearOutputs()

    try {
      let generatedFiles
      if (activeToolId === 'image-to-pdf') generatedFiles = await createPdfFromImages()
      else if (activeToolId === 'pdf-to-image') generatedFiles = await createImagesFromPdfs()
      else generatedFiles = await createExcelFromPdfs()

      const outputFiles = generatedFiles.map((file) => {
        const url = URL.createObjectURL(file.blob)
        outputUrlsRef.current.push(url)
        return { ...file, url }
      })

      setOutputs(outputFiles)
      setNotice(`Done. ${outputFiles.length} file${outputFiles.length === 1 ? '' : 's'} ready to download.`)
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : 'Conversion failed. Please try another file.')
    } finally {
      setIsProcessing(false)
    }
  }

  const openFilePicker = () => fileInputRef.current?.click()
  const ToolIcon = activeTool.icon

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="sidebar">
          <a className="brand" href="#" aria-label="Paperflow home" onClick={(event) => event.preventDefault()}>
            <span className="brand-mark"><FileText size={21} /></span>
            <span>
              <span className="brand-kicker">DOCUMENT STUDIO</span>
              <strong>Paperflow</strong>
            </span>
          </a>

          <div className="sidebar-label">TOOLS</div>
          <nav className="tool-nav" aria-label="Document tools">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  className={`tool-nav-item${tool.id === activeToolId ? ' active' : ''}`}
                  onClick={() => selectTool(tool.id)}
                  aria-current={tool.id === activeToolId ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>{tool.title}</span>
                </button>
              )
            })}
          </nav>

          <div className="privacy-card">
            <span className="privacy-icon"><ShieldCheck size={17} /></span>
            <div>
              <strong>Private by design</strong>
              <p>Your files are processed in this browser, not uploaded to a server.</p>
            </div>
          </div>
          <div className="sidebar-footer"><Sparkles size={15} /> Simple tools, right in your browser</div>
        </aside>

        <main className="workspace">
          <header className="page-header">
            <div>
              <p className="eyebrow">PDF TOOLS <span> / </span> CONVERT</p>
              <h1>Make documents work for you.</h1>
              <p className="page-subtitle">A few useful file conversions, without the busywork.</p>
            </div>
            <span className="secure-badge"><ShieldCheck size={15} /> Files stay on your device</span>
          </header>

          <section className="tool-cards" aria-label="Choose a conversion tool">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  className={`tool-card${tool.id === activeToolId ? ' selected' : ''}`}
                  key={tool.id}
                  onClick={() => selectTool(tool.id)}
                  aria-pressed={tool.id === activeToolId}
                >
                  <span className="tool-card-icon"><Icon size={19} /></span>
                  <span className="tool-card-copy">
                    <strong>{tool.title}</strong>
                    <span>{tool.description}</span>
                  </span>
                </button>
              )
            })}
          </section>

          <section className="converter-panel">
            <div className="converter-heading">
              <div className="converter-icon"><ToolIcon size={21} /></div>
              <div>
                <h2>{activeTool.title}</h2>
                <p>{activeTool.detail}</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept={activeTool.accept}
              multiple
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
              aria-label={`Choose files for ${activeTool.title}`}
            />

            <div
              className={`drop-zone${isDragging ? ' dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                addFiles(event.dataTransfer.files)
              }}
            >
              <div className="upload-icon"><UploadCloud size={24} /></div>
              <strong>Drop your files here</strong>
              <span>or choose files from your device</span>
              <button type="button" className="choose-button" onClick={openFilePicker}>
                Browse files
              </button>
              <small>Accepted: {activeTool.extensions.map((extension) => `.${extension}`).join(', ')}</small>
            </div>

            {error && <p className="feedback error" role="alert">{error}</p>}
            {notice && <p className="feedback notice" role="status">{notice}</p>}

            {selectedFiles.length > 0 && (
              <div className="file-list">
                <div className="file-list-heading">
                  <h3>Selected files</h3>
                  <span>{selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}</span>
                </div>
                {selectedFiles.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
                    <span className="file-icon"><FileText size={18} /></span>
                    <span className="file-details">
                      <strong>{file.name}</strong>
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeFile(file)}
                      aria-label={`Remove ${file.name}`}
                      disabled={isProcessing}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="convert-button"
                  onClick={convertFiles}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? <><LoaderCircle size={18} className="spinner" /> Converting...</>
                    : <><ToolIcon size={18} /> {activeTool.title}</>}
                </button>
              </div>
            )}

            {outputs.length > 0 && (
              <div className="output-list" aria-live="polite">
                <div className="file-list-heading">
                  <h3>Ready to download</h3>
                  <span>{outputs.length} {outputs.length === 1 ? 'file' : 'files'}</span>
                </div>
                {outputs.map((output) => (
                  <div className="output-row" key={output.url}>
                    <span className="file-icon output-icon">
                      {output.previewType === 'image'
                        ? <Image size={18} />
                        : output.previewType === 'spreadsheet'
                          ? <FileSpreadsheet size={18} />
                          : <FileText size={18} />}
                    </span>
                    <span className="file-details">
                      <strong>{output.name}</strong>
                      <small>{formatBytes(output.blob.size)}</small>
                    </span>
                    {output.previewType === 'image' && (
                      <img className="image-preview" src={output.url} alt={`Preview of ${output.name}`} />
                    )}
                    <a className="download-button" href={output.url} download={output.name} aria-label={`Download ${output.name}`}>
                      <ArrowDownToLine size={17} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="conversion-note">
            PDF to Excel works with selectable text. Scanned documents need OCR, which is not included.
          </p>
        </main>
      </div>
    </div>
  )
}

export default App
