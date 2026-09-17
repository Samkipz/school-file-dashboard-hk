import { describe, expect, it } from 'vitest'
import { draftInput, planningFields, typeInput, versionInput } from '../../lib/domain/assessment-validation'

const id = '12345678-1234-4123-8123-123456789012'
const draft = { title: 'Plan', offering_id: id, assessment_type_id: id, tasks: [] }
describe('draft planning validation', () => {
  it('accepts no tasks and absent dates/term', () => {
    expect(draftInput(draft)).toMatchObject({ term_id: null, starts_on: null, due_on: null, tasks: [] })
  })
  it('allows dates spanning terms and either date independently', () => {
    expect(planningFields({ title: 'Plan', starts_on: '2026-01-01', due_on: '2026-12-31' }).due_on).toBe('2026-12-31')
    expect(planningFields({ title: 'Plan', due_on: '2026-12-31' }).starts_on).toBeNull()
  })
  it.each(['2026-02-30','2026-2-01','yesterday','2026-13-01'])('rejects invalid calendar date %s', starts_on => {
    expect(() => planningFields({ title: 'Plan', starts_on })).toThrow('INVALID_INPUT')
  })
  it('rejects reversed dates', () => expect(() => planningFields({ title: 'Plan', starts_on: '2026-02-01', due_on: '2026-01-01' })).toThrow('INVALID_INPUT'))
  it('enforces field boundaries', () => {
    expect(planningFields({ title: 'a'.repeat(160), instructions: 'b'.repeat(4000) }).title.length).toBe(160)
    for (const value of [{title:''},{title:' '},{title:'a'.repeat(161)},{title:'x',instructions:'b'.repeat(4001)},{title:42},{title:'x',instructions:'bad\u0000text'}]) expect(() => planningFields(value)).toThrow('INVALID_INPUT')
  })
  it('enforces task boundaries and required identities', () => {
    expect(draftInput({ ...draft, tasks: Array.from({ length: 100 }, () => ({title:'Task'})) }).tasks).toHaveLength(100)
    for (const value of [{ ...draft, tasks: Array(101).fill({title:'Task'}) }, { ...draft, tasks: {} }, { ...draft, offering_id: '' }, { ...draft, term_id: 'bad' }, null]) expect(() => draftInput(value)).toThrow('INVALID_INPUT')
  })
  it('validates configurable types without curriculum formulas', () => {
    expect(typeInput({code:'LOCAL_TYPE',name:'Local type',enabled:true}).code).toBe('LOCAL_TYPE')
    for (const code of ['lowercase','A B','A'.repeat(65),'']) expect(() => typeInput({code,name:'x',enabled:true})).toThrow('INVALID_INPUT')
  })
  it('carries canonical existing task IDs and discards temporary client identity', () => {
    expect(draftInput({...draft,tasks:[{id:id.toUpperCase(),title:'Existing'},{clientKey:id,title:'New'}]}).tasks).toEqual([
      {...planningFields({title:'Existing'}),id},planningFields({title:'New'}),
    ])
  })
  it('rejects malformed and duplicate task identity claims', () => {
    for (const tasks of [[{id:null,title:'Task'}],[{id:'bad',title:'Task'}],[{id,title:'A'},{id:id.toUpperCase(),title:'B'}]]) {
      expect(()=>draftInput({...draft,tasks})).toThrow('INVALID_INPUT')
    }
  })
  it.each([' ','\t','\n',' \t\r\n\u00a0\u2003\u2028\ufeff'])('rejects whitespace-only protected text %j', title => {
    expect(()=>planningFields({title})).toThrow('INVALID_INPUT')
    expect(()=>typeInput({code:'TEST',name:title,enabled:true})).toThrow('INVALID_INPUT')
  })
  it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'1',null])('rejects unsafe version %s', value => expect(() => versionInput(value)).toThrow('INVALID_INPUT'))
})
