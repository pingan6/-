export type BackendConfiguration = { base: string; error: string | null }

/** Resolve one backend address; public deployments must never call the visitor's computer. */
export function resolveBackendConfiguration(hostname: string, protocol: string, runtimeUrl?: string, buildtimeUrl?: string): BackendConfiguration {
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
  const supplied = runtimeUrl ?? buildtimeUrl
  if (supplied === undefined) return local
    ? { base: 'http://localhost:8000', error: null }
    : { base: '', error: '公网后台尚未配置，暂不能创建项目或保存内容。请管理员完成后台部署。' }
  const base = supplied.trim().replace(/\/+$/, '')
  // An explicitly empty base selects a deliberately configured same-origin API.
  if (!base) return { base: '', error: null }
  try {
    const parsed = new URL(base)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('invalid backend address')
    if (!local && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname)) return { base: '', error: '公网后台地址错误：不能连接访问者的本机地址。请管理员配置真实公网后台。' }
    if (protocol === 'https:' && parsed.protocol !== 'https:') return { base: '', error: '后台地址必须使用 HTTPS，否则浏览器会阻止连接。' }
    return { base, error: null }
  } catch {
    return { base: '', error: '后台地址配置无效，请管理员检查部署配置。' }
  }
}

/** Explain failures without displaying response bodies, credentials or provider diagnostics. */
export function describeBackendFailure(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : undefined
  if (status === 401 || status === 403) return '后台访问被拒绝，请管理员检查登录与访问权限。'
  if (status === 404) return '后台接口不存在或尚未部署，请管理员检查后台地址。'
  if (status === 422) return '提交的数据不符合要求，请检查表单内容。'
  if (status !== undefined && status >= 500) return '后台服务异常，内容尚未保存，请稍后重试。'
  return '无法连接后台，内容尚未保存，请检查网络、后台服务及跨域配置后重试。'
}
