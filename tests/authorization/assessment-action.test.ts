import { beforeEach, expect, it, vi } from 'vitest'
import { DomainError } from '../../lib/domain/foundation'
const mocks = vi.hoisted(() => ({save:vi.fn(),open:vi.fn(),saveType:vi.fn(),initializeTypes:vi.fn(),revalidatePath:vi.fn()}))
vi.mock('@/lib/domain/server',()=>({assessments:mocks}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidatePath}))
import { planAssessment } from '../../app/actions/assessments'
import { DefinitionError } from '../../lib/domain/scoring-guide'
const form = (value: string) => {const f=new FormData();f.set('payload',value);return f}
beforeEach(()=>vi.resetAllMocks())
it('returns controlled malformed and oversized payload errors',async()=>{
  for(const payload of ['{','null','[]','a'.repeat(3000001),'{"id":3}','{"expectedVersion":"1"}']) {
    const result=await planAssessment('school','save',{ok:false,message:''},form(payload))
    expect(result.ok).toBe(false)
  }
  expect(mocks.save).not.toHaveBeenCalled()
})
it.each(['UNAUTHORIZED','FORBIDDEN','NOT_FOUND','INVALID_INPUT','CONFLICT'] as const)('preserves controlled %s service denial',async code=>{
  mocks.save.mockRejectedValueOnce(new DomainError(code))
  const result=await planAssessment('school','save',{ok:false,message:''},form('{}'))
  expect(result.ok).toBe(false);expect(mocks.revalidatePath).not.toHaveBeenCalled()
  if(code==='CONFLICT')expect(result.message).toContain('Reload')
})
it('revalidates only after successful authorized mutation',async()=>{
  mocks.save.mockResolvedValueOnce({id:'draft'})
  const result=await planAssessment('school','save',{ok:false,message:''},form('{"id":"draft","expectedVersion":2}'))
  expect(result.resourceId).toBe('draft');expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/assessments')
})
it('does not disclose unexpected persistence errors',async()=>{
  mocks.save.mockRejectedValueOnce(new Error('private SQL connection information'))
  expect((await planAssessment('school','save',{ok:false,message:''},form('{}'))).message).toBe('Unable to save. Please try again.')
})
it('carries task identities and order to the authorized service unchanged',async()=>{
  const payload={id:'draft',expectedVersion:7,tasks:[{id:'existing-b',title:'B'},{title:'New',clientKey:'temporary'},{id:'existing-a',title:'A'}]}
  mocks.save.mockResolvedValueOnce({id:'draft'})
  await planAssessment('school','save',{ok:false,message:''},form(JSON.stringify(payload)))
  expect(mocks.save).toHaveBeenCalledWith('school',payload,'draft',7)
})
it('opens only through the domain service and returns actionable structure errors', async () => {
  mocks.open.mockRejectedValueOnce(new DefinitionError(['Task 1: add at least one criterion.']))
  const result = await planAssessment('school','open',{ok:false,message:''},form('{"id":"draft","expectedVersion":7}'))
  expect(mocks.open).toHaveBeenCalledWith('school','draft',7)
  expect(result).toEqual({ok:false,message:'Task 1: add at least one criterion.'})
  expect(mocks.revalidatePath).not.toHaveBeenCalled()
})
