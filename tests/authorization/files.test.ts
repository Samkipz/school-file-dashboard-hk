import { describe,it,expect,vi,beforeEach } from 'vitest'
import type { Pool } from 'pg'
import { fileService } from '../../lib/domain/files'
const school='12345678-1234-4123-8123-123456789012'
describe('file authorization boundary',()=>{
 const storage={upload:vi.fn(),read:vi.fn()}
 beforeEach(()=>vi.clearAllMocks())
 it('rejects anonymous access before database or storage',async()=>{
  const connect=vi.fn(),service=fileService({connect} as unknown as Pool,async()=>null,storage)
  for(const operation of [()=>service.listLearners(school),()=>service.listFolders(school),()=>service.list(school,{learnerId:school}),()=>service.upload(school,{learnerId:school},new FormData()),()=>service.download(school,school),()=>service.archive(school,school),()=>service.update(school,school,'title','','general')])await expect(operation()).rejects.toThrow('UNAUTHORIZED')
  expect(connect).not.toHaveBeenCalled();expect(storage.upload).not.toHaveBeenCalled();expect(storage.read).not.toHaveBeenCalled()
 })
 it.each(['teacher','moderator'])('denies %s administration before object lookup or storage',async role=>{
  const query=vi.fn().mockResolvedValue({rows:[{school_id:school,membership_id:school,actor_id:school,roles:[role]}]})
  const service=fileService({connect:async()=>({query,release:vi.fn()})} as unknown as Pool,async()=> 'user',storage)
  for(const operation of [()=>service.upload(school,{learnerId:school},new FormData()),()=>service.saveFolder(school,'name',''),()=>service.archive(school,school),()=>service.update(school,school,'title','','general'),()=>service.listFolders(school)])await expect(operation()).rejects.toThrow('FORBIDDEN')
  expect(storage.upload).not.toHaveBeenCalled();expect(query.mock.calls.some(([sql])=>String(sql).includes('media_assets'))).toBe(false)
 })
})
