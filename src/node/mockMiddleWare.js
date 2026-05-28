/**
 * Mock Server 中间件
 *
 * 供各 app 共用的 mock 中间件，基于目录结构自动发现 mock 接口文件，
 * 支持文件监听热更新和空文件自动抓取真实数据。
 *
 * ── 启用方式 ──────────────────────────────────────────────
 *
 * 设置环境变量 VUE_APP_MOCK=true 即可启用，未设置时所有请求正常走代理：
 *
 *   VUE_APP_MOCK=true vue-cli-service serve
 *   # 或在 package.json scripts 中：
 *   # "serve:mock": "VUE_APP_MOCK=true vue-cli-service serve"
 *
 * 可选：IS_DEBUG_LOG=true 开启请求日志（打印每条收到的请求路径）。
 *
 * ── 在 vue.config.js 中接入 ──────────────────────────────
 *
 *   const { setupMock } = require("../mock");
 *
 *   module.exports = {
 *     devServer: {
 *       proxy: {
 *         "/api": {
 *           target: "http://example.com",
 *           changeOrigin: true,
 *         },
 *       },
 *       onBeforeSetupMiddleware(devServer) {
 *         setupMock(devServer, __dirname, ["/api"]);
 *       },
 *     },
 *   };
 *
 * 参数说明：
 *   devServer   — webpack-dev-server 实例（onBeforeSetupMiddleware 回调参数）
 *   appRoot     — app 根目录绝对路径，用于定位 ./mock 子目录
 *   proxyPaths  — 需要拦截的接口路径前缀数组，顺序必须与 devServer.proxy 配置一致
 *                 例如 ["/api"] 或 ["/api", "/base/api"]
 *
 * ── Mock 文件约定 ─────────────────────────────────────────
 *
 * 在 app 的 mock/ 目录下，按接口路径创建 .json 文件，目录层级 = 接口路径层级。
 *
 * 例：mock 接口 POST /api/xxx/yyy/zzz
 *
 *   mock/api/xxx/yyy/zzz.json
 *   └── { "code": 0, "msg": "", "data": { ... } }
 *
 * 规则：
 *   - 文件路径（去掉 mock/ 前缀和 .json 后缀）= 接口完整路径
 *   - 请求方法不限（GET/POST 均匹配同一文件）
 *   - 返回数据会自动注入 "mock": true 标记字段
 *   - 找不到对应 .json 文件的请求，自动 fallback 到 devServer.proxy 代理
 *
 * ── 特性：空文件自动抓取 ──────────────────────────────────
 *
 * 创建一个 0 字节的空 .json 文件，首次请求时：
 *   1. 自动转发到真实代理接口获取 response
 *   2. 将 response 格式化写入该 .json 文件
 *   3. 后续请求直接返回 mock 数据
 *
 * 如果真实接口请求失败，不会写入文件，下次请求继续尝试抓取。
 * 重新抓取：清空 .json 文件内容使其变为 0 字节即可。
 *
 * ── 特性：文件监听热更新 ──────────────────────────────────
 *
 * mock/ 目录下的 .json 文件增删改会自动触发重新收集，无需重启 dev server，
 * 刷新页面即可拿到最新数据。
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import { URL } from 'url'
const IS_DEBUG = process.env.IS_DEBUG_LOG === 'true'
/**
 * 递归收集 mock 目录下的所有 .json 文件
 * @param {string} dir - 当前遍历目录
 * @param {string} rootDir - mock 根目录（用于计算相对路径）
 * @returns {Object} - 映射对象 { "/api/path/to/file": "/absolute/path/to/file.json" }
 */
function collectMockFiles(dir, rootDir) {
  const files = {}
  const items = fs.readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    // 跳过 node_modules 和隐藏目录（如 .DS_Store 所在的 ._* 目录）
    if (item.name === 'node_modules' || item.name.startsWith('.')) {
      continue
    }
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      Object.assign(files, collectMockFiles(fullPath, rootDir))
    } else if (item.isFile() && item.name.endsWith('.json')) {
      const relativePath =
        '/' +
        path
          .relative(rootDir, fullPath)
          .replace(/\.json$/, '')
          .replace(/\\/g, '/')
      files[relativePath] = fullPath
    }
  }

  return files
}

/**
 * 转发请求到真实代理服务器，获取 response 数据
 * @param {Object} req - Express request
 * @param {string} proxyTarget - 代理目标地址
 * @returns {Promise<Object>} - response JSON
 */
function forwardToProxy(req, proxyTarget) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(req.originalUrl || req.url, proxyTarget)
    const isHttps = targetUrl.protocol === 'https:'
    const client = isHttps ? https : http

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      timeout: 30000,
      headers: {
        ...req.headers,
        host: targetUrl.hostname,
      },
    }

    // 删除可能导致问题的 headers
    delete options.headers['content-length']
    delete options.headers['transfer-encoding']
    // 删除 accept-encoding，避免后端返回 gzip 压缩数据
    delete options.headers['accept-encoding']

    const proxyReq = client.request(options, (proxyRes) => {
      let data = ''
      proxyRes.on('data', (chunk) => {
        data += chunk
      })
      proxyRes.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          reject(new Error('Failed to parse proxy response: ' + e.message))
        }
      })
    })

    proxyReq.on('error', (err) => {
      reject(err)
    })

    proxyReq.on('timeout', () => {
      proxyReq.destroy()
      reject(new Error('Proxy request timed out'))
    })

    // 如果 req 已经被 body-parser 处理过，req.body 会有数据
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body)
      proxyReq.setHeader('Content-Type', 'application/json')
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
      proxyReq.write(bodyData)
      proxyReq.end()
    } else if (req.readableEnded) {
      // req 流已经结束，无法再次读取
      proxyReq.end()
    } else {
      // 否则尝试从 req 流中读取
      const bodyChunks = []
      req.on('data', (chunk) => {
        bodyChunks.push(chunk)
      })
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks)
        if (body.length > 0) {
          proxyReq.setHeader('Content-Length', body.length)
          proxyReq.write(body)
        }
        proxyReq.end()
      })
      req.on('error', (err) => {
        reject(err)
      })
    }
  })
}

/**
 * 创建 mock 中间件
 * @param {string} mockDir - mock 数据根目录绝对路径
 * @param {string} proxyTarget - 代理目标地址
 * @returns {Function} - Express middleware
 */
function createMockMiddleware(mockDir, proxyTarget, mockFilesRef) {
  if (!fs.existsSync(mockDir)) {
    return (req, res, next) => next()
  }

  // 记录正在录制中的路径，避免并发请求同一空文件时重复抓取
  const recording = new Set()

  return async (req, res, next) => {
    // 去掉 query string，只按路径匹配 mock 文件
    const urlPath = (req.originalUrl || req.url).split('?')[0]
    const mockFile = mockFilesRef.current[urlPath]
    IS_DEBUG && console.log(`[Mock] recv request  ${req.method}: ${req.originalUrl}`)
    if (!mockFile) {
      next()
      return
    }

    // 文件存在但为空（0 字节），自动抓取真实数据
    const stats = fs.statSync(mockFile)
    if (stats.size === 0) {
      if (recording.has(urlPath)) {
        // 正在录制中，直接走代理避免重复抓取
        next()
        return
      }
      recording.add(urlPath)
      try {
        console.log(`[Mock] Recording ${req.originalUrl}...`)
        const data = await forwardToProxy(req, proxyTarget)
        fs.writeFileSync(mockFile, JSON.stringify(data, null, 2) + '\n')
        console.log(`[Mock] Recorded ${req.originalUrl} successfully`)
        res.json(data)
      } catch (err) {
        console.error(`[Mock] Failed to record ${req.originalUrl}:`, err.message)
        next()
      } finally {
        recording.delete(urlPath)
      }
      return
    }

    // 正常返回 mock 数据
    const data = JSON.parse(fs.readFileSync(mockFile, 'utf-8'))
    data.mock = true
    console.log(`[Mock] ${req.method}: ${req.originalUrl} , return mock data`)
    res.json(data)
  }
}

/**
 * 配置 devServer 的 mock 支持
 * @param {Object} devServer - webpack-dev-server 实例
 * @param {string} appRoot - app 根目录（用于定位 mock 目录）
 * @param {string[]} proxyPaths - 需要代理的接口路径数组，顺序需与 devServer.proxy 配置一致
 *   例如：["/api"] 或 ["/api", "/base/api"]
 */
function setupMock(devServer, appRoot, proxyPaths) {
  if (process.env.VUE_APP_MOCK !== 'true') {
    console.log('[Mock] Disabled')
    return
  }
  console.log(`[Mock] Enabled ,IS_DEBUG=${IS_DEBUG} `)

  const mockDir = path.resolve(appRoot, './mock')

  // 收集 mock 文件（所有中间件共享）
  const mockFilesRef = { current: collectMockFiles(mockDir, mockDir) }
  console.log('[Mock] collect mock apis: ', Object.keys(mockFilesRef.current))
  // 监听 mock 目录变化，自动重新收集文件
  try {
    fs.watch(mockDir, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        console.log(`[Mock] File changed: ${filename}, re-collecting...`)
        mockFilesRef.current = collectMockFiles(mockDir, mockDir)
        console.log('[Mock] File re-collect end , apis: ', Object.keys(mockFilesRef.current))
      }
    })
  } catch (err) {
    console.warn('[Mock] Failed to watch mock directory:', err.message)
  }

  // 从 devServer.options.proxy 中按顺序提取 target
  const proxy = devServer.options?.proxy
  const proxyConfigs = Array.isArray(proxy) ? proxy : Object.values(proxy)

  for (let i = 0; i < proxyPaths.length; i++) {
    const proxyPath = proxyPaths[i]
    const config = proxyConfigs[i]
    const proxyTarget = typeof config === 'string' ? config : config?.target
    if (!proxyTarget) {
      console.warn(`[Mock] No proxy target found for ${proxyPath}, skip`)
      continue
    }

    console.log(`[Mock] Setup mock for path: ${proxyPath}, target: ${proxyTarget}`)
    devServer.app.use(proxyPath, createMockMiddleware(mockDir, proxyTarget, mockFilesRef))
  }
}

export {
  setupMock,
}
