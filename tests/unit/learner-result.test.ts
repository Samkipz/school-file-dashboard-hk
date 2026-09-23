import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { calculateResult, requireComplete, requireTransition, nextLearner, resultInput } from '../../lib/domain/learner-result'
const c1=randomUUID(), c2=randomUUID(), i1=randomUUID(), i2=randomUUID()
const tasks=[{criteria:[{id:c1,title:'Composition',description:null,indicators:[{id:i1,descriptor:'Clear',score:'1.10'}]}]},{criteria:[{id:c2,title:'Exposure',description:null,indicators:[{id:i2,descriptor:'Clear',score:'2.25'}]}]}]
const observations=[{criterion_id:c1,indicator_id:i1},{criterion_id:c2,indicator_id:i2}]
describe('learner results', () => {
  it('derives exact criterion, task and assessment totals', () => { const r=calculateResult(tasks,[],observations,'completed'); expect(r.units).toBe(335); expect(r.score).toBe('3.35'); expect(r.tasks.map(t=>t.units)).toEqual([110,225]); expect(r.tasks[0].criteria[0].units).toBe(110); expect(r.performance).toBeNull() })
  it('interprets configured ranges only when all criteria are observed', () => { const levels=[{code:'CUSTOM',descriptor:'Secure',lower:'0',upper:'3.35'}]; expect(calculateResult(tasks,levels,observations,'completed').performance?.code).toBe('CUSTOM'); expect(calculateResult(tasks,levels,observations.slice(0,1),'in_progress').performance).toBeNull() })
  it('keeps partial progress and explains missing criteria', () => {const r=calculateResult(tasks,[],observations.slice(0,1),'in_progress');expect(r.score).toBe('1.10');expect(r.missing).toEqual(['Task 2, criterion 1: Exposure']);expect(()=>requireComplete(r)).toThrow('INVALID_INPUT')})
  it.each(['absent','not_started'] as const)('%s has no numeric score', status => {expect(calculateResult(tasks,[],[],status).score).toBeNull();expect(()=>calculateResult(tasks,[],observations,status)).toThrow()})
  it('rejects wrong criterion, wrong indicator and duplicate criterion',()=>{for(const bad of [[{criterion_id:randomUUID(),indicator_id:i1}],[{criterion_id:c1,indicator_id:i2}],[observations[0],observations[0]]])expect(()=>calculateResult(tasks,[],bad,'in_progress')).toThrow()})
  it.each(['save','complete','absent','begin'] as const)('completed rejects %s', command=>expect(()=>requireTransition('completed',command)).toThrow('CONFLICT'))
  it('absence requires explicit begin',()=>{expect(()=>requireTransition('absent','begin')).not.toThrow();for(const cmd of ['save','complete','absent'] as const)expect(()=>requireTransition('absent',cmd)).toThrow();expect(()=>requireTransition('in_progress','begin')).toThrow()})
  it('allows partial save and explicit completion transitions',()=>{expect(()=>requireTransition('not_started','save')).not.toThrow();expect(()=>requireTransition('in_progress','complete')).not.toThrow();expect(()=>requireComplete(calculateResult(tasks,[],observations,'in_progress'))).not.toThrow()})
  it('next follows supplied order, includes absent/completed and never wraps',()=>{const roster=[{id:'b'},{id:'a'}];expect(nextLearner(roster,'b')).toBe('a');expect(nextLearner(roster,'a')).toBeNull();expect(()=>nextLearner(roster,'x')).toThrow()})
  it('rejects arbitrary scores, duplicate assets and oversized feedback',()=>{const base={observations,evidence:[],feedback:null};expect(resultInput(base)).toEqual(base);for(const bad of [{...base,total:20},{...base,feedback:'x'.repeat(4001)},{...base,observations:[{...observations[0],score:3}]},{...base,evidence:[{asset_id:i1},{asset_id:i1}]}])expect(()=>resultInput(bad)).toThrow()})
})
