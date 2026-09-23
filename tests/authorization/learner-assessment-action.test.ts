import { beforeEach, expect, it, vi } from 'vitest'
import { DomainError } from '../../lib/domain/foundation'
import { DefinitionError } from '../../lib/domain/scoring-guide'
const mocks=vi.hoisted(()=>({mutate:vi.fn(),revalidatePath:vi.fn()}))
vi.mock('@/lib/domain/server',()=>({learnerAssessments:mocks}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidatePath}))
import { assessLearner } from '../../app/actions/learner-assessments'
const form=(payload: string,command='save')=>{const f=new FormData();f.set('payload',payload);f.set('command',command);return f}
beforeEach(()=>vi.resetAllMocks())
it('rejects malformed and oversized payloads and unsupported commands',async()=>{for(const f of [form('{'),form('[]'),form('x'.repeat(2000001)),form('{}','reopen'),form('{"score":2}')])expect((await assessLearner('school','assessment','learner',f)).ok).toBe(false);expect(mocks.mutate).not.toHaveBeenCalled()})
it.each(['UNAUTHORIZED','FORBIDDEN','NOT_FOUND','INVALID_INPUT','CONFLICT'] as const)('returns controlled %s and does not revalidate on failure',async code=>{mocks.mutate.mockRejectedValue(new DomainError(code));expect((await assessLearner('school','assessment','learner',form('{}'))).ok).toBe(false);expect(mocks.revalidatePath).not.toHaveBeenCalled()})
it('returns actionable completion errors and hides private errors',async()=>{mocks.mutate.mockRejectedValueOnce(new DefinitionError(['2 criteria still need observations.']));expect((await assessLearner('s','a','l',form('{}'))).message).toContain('2 criteria');mocks.mutate.mockRejectedValueOnce(new Error('private connection string'));expect((await assessLearner('s','a','l',form('{}'))).message).not.toContain('private')})
it('only navigates/revalidates after the service commits',async()=>{mocks.mutate.mockResolvedValue({result:{score:'3.35',maximum:'3.35'},next:'next'});const result=await assessLearner('s','a','l',form('{"expectedVersion":1,"input":{}}','complete'));expect(result).toEqual({ok:true,message:'Completed: 3.35 / 3.35.',next:'next'});expect(mocks.revalidatePath).toHaveBeenCalledWith('/academics')})
