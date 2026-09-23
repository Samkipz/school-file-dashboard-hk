import { beforeEach, expect, it, vi } from 'vitest'
import { DomainError } from '../../lib/domain/foundation'
const mocks=vi.hoisted(()=>({get:vi.fn(),download:vi.fn()}))
vi.mock('@/lib/domain/server',()=>({learnerAssessments:{get:mocks.get},schoolFiles:{download:mocks.download}}))
import { GET } from '../../app/academics/evidence/[id]/route'
beforeEach(()=>vi.resetAllMocks())
const request=()=>GET(new Request('http://localhost/academics/evidence/link?school=s&assessment=a&learner=l'),{params:Promise.resolve({id:'link'})})
it.each(['UNAUTHORIZED','FORBIDDEN','NOT_FOUND'] as const)('denies %s before reading any storage',async code=>{mocks.get.mockRejectedValue(new DomainError(code));expect((await request()).status).toBe({UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404}[code]);expect(mocks.download).not.toHaveBeenCalled()})
it('rejects forged or unavailable association IDs',async()=>{for(const evidence of [[],[{id:'different',available:true,asset_id:'asset'}],[{id:'link',available:false,asset_id:'asset'}]]){mocks.get.mockResolvedValue({evidence});expect((await request()).status).toBe(404)}expect(mocks.download).not.toHaveBeenCalled()})
it('reuses private transport after full assessment authorization',async()=>{mocks.get.mockResolvedValue({evidence:[{id:'link',available:true,asset_id:'asset'}]});mocks.download.mockResolvedValue({bytes:new Uint8Array([1]),mimeType:'application/pdf',name:'safe.pdf'});const response=await request();expect(mocks.get).toHaveBeenCalledWith('s','a','l');expect(mocks.download).toHaveBeenCalledWith('s','asset');expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store')})
it('isolates storage failure from result data',async()=>{mocks.get.mockResolvedValue({evidence:[{id:'link',available:true,asset_id:'asset'}]});mocks.download.mockRejectedValue(new Error('private storage details'));const response=await request();expect(response.status).toBe(503);expect(await response.text()).toBe('Evidence unavailable')})
