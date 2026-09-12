import { DomainError } from './foundation'
// Keep database/provider diagnostics out of remotely callable action responses.
export async function fileAction<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() }
  catch (error) {
    if (error instanceof DomainError) throw new Error(error.code)
    console.error('School file operation failed')
    throw new Error('File operation could not be completed. Please try again or contact your administrator.')
  }
}
