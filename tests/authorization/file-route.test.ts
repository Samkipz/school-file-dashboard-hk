import { expect,it,vi } from 'vitest'
import { DomainError } from '../../lib/domain/foundation'
const download=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/domain/server',()=>({schoolFiles:{download}}))
import { GET } from '../../app/media-files/file/[id]/route'
it('requires authorization on every private byte request and never caches failures',async()=>{
 for(const [code,status] of [['UNAUTHORIZED',401],['FORBIDDEN',403],['NOT_FOUND',404],['INVALID_INPUT',400]] as const){download.mockRejectedValueOnce(new DomainError(code));const r=await GET(new Request('http://localhost/media-files/file/id?school=foreign'),{params:Promise.resolve({id:'id'})});expect(r.status).toBe(status);expect(r.headers.get('Cache-Control')).toBe('private, no-store')}
})
it('serves only authorized bytes with safe attachment headers',async()=>{
 download.mockResolvedValueOnce({bytes:new Uint8Array([1,2]),mimeType:'application/pdf',name:'evil"\r\n.pdf'});const r=await GET(new Request('http://localhost/media-files/file/id?school=school&view=1'),{params:Promise.resolve({id:'id'})});expect(r.status).toBe(200);expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="evil___.pdf"');expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();expect(download).toHaveBeenLastCalledWith('school','id')
})
