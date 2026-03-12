import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite plugin that proxies external image requests to bypass CORS.
 * Used when importing HTML with external images (e.g., from Freshdesk).
 * Endpoint: /api/image-proxy?url=<encoded-url>
 */
const ALLOWED_IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|ico)$/i
const MAX_PROXY_SIZE = 10 * 1024 * 1024 // 10MB
const BLOCKED_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|\[::1?\])$/i

function imageProxyPlugin() {
  return {
    name: 'image-proxy',
    configureServer(server) {
      server.middlewares.use('/api/image-proxy', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const targetUrl = url.searchParams.get('url')

        if (!targetUrl) {
          res.statusCode = 400
          res.end('Missing url parameter')
          return
        }

        // Validate URL to prevent SSRF
        let parsed
        try {
          parsed = new URL(targetUrl)
        } catch {
          res.statusCode = 400
          res.end('Invalid URL')
          return
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          res.statusCode = 400
          res.end('Only http/https URLs are allowed')
          return
        }

        if (BLOCKED_HOSTS.test(parsed.hostname)) {
          res.statusCode = 403
          res.end('Access to internal hosts is not allowed')
          return
        }

        try {
          const response = await fetch(targetUrl, { signal: AbortSignal.timeout(10000) })
          if (!response.ok) {
            res.statusCode = response.status
            res.end(`Upstream error: ${response.status}`)
            return
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          if (!ALLOWED_IMAGE_TYPES.test(contentType)) {
            res.statusCode = 415
            res.end('Only image content types are allowed')
            return
          }

          const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
          if (contentLength > MAX_PROXY_SIZE) {
            res.statusCode = 413
            res.end('Image too large')
            return
          }

          res.setHeader('Content-Type', contentType)
          res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
          res.setHeader('Cache-Control', 'public, max-age=86400')

          const buffer = await response.arrayBuffer()
          if (buffer.byteLength > MAX_PROXY_SIZE) {
            res.statusCode = 413
            res.end('Image too large')
            return
          }
          res.end(Buffer.from(buffer))
        } catch (err) {
          res.statusCode = 502
          res.end(`Proxy error: ${err.message}`)
        }
      })
    },
  }
}

export default defineConfig({
  base: '/paricus-editor/',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    imageProxyPlugin(),
  ],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
