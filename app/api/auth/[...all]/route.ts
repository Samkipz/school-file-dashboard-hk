import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

const { GET: betterAuthGET, POST: betterAuthPOST } = toNextJsHandler(auth.handler)

// Wrap handlers to add CORS headers for development
const createCorsHandler = (handler: any) => {
  return async (request: Request, context: any) => {
    // Call the original handler
    const response = await handler(request, context)
    
    // Clone the response so we can modify headers
    const newResponse = new Response(response.body, response)
    
    // Add CORS headers
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE,PUT')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    // Allow any origin in dev
    const origin = request.headers.get('origin') || '*'
    newResponse.headers.set('Access-Control-Allow-Origin', origin)
    
    return newResponse
  }
}

export const GET = createCorsHandler(betterAuthGET)
export const POST = createCorsHandler(betterAuthPOST)

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin') || '*'
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}
