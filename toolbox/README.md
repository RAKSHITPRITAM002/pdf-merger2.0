# Paperflow document tools

A small browser-based toolbox for converting common document formats:

- **Images to PDF** combines JPG and PNG images into a multi-page PDF.
- **PDF to images** exports each page of one or more PDFs as a PNG.
- **PDF to Excel** extracts selectable text into an `.xlsx` workbook, with a worksheet for each PDF.

## Run locally

```sh
npm install
npm run dev
```

Conversions run in your browser; files are not uploaded to a server. PDF-to-Excel uses text positions to approximate rows and columns, so its output may need cleanup. Scanned PDFs require OCR and are not supported.
