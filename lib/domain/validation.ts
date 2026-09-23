export class DomainError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT'
  constructor(code: DomainError['code']) { super(code); this.code = code }
}
export function uuidInput(value: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new DomainError('INVALID_INPUT')
  return value
}
export function learnerName(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) throw new DomainError('INVALID_INPUT')
  return value.trim()
}
