import { spawn } from 'node:child_process'
import { createWriteStream, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
// Explicit integration runner: executes the existing suites unchanged, serially,
// since rollback fixtures lock the same development school.
const evidence=resolve('.github/verification/learner-assessments'),results=[]
const suites=process.argv.includes('--browser') ? [
  ['teaching-browser','teaching-browser-smoke.mjs',[]],
  ['admin-browser','admin-browser-smoke.mjs',[]],
  ['assessment-browser','assessment-browser-smoke.mjs',['--retain-test-evidence']],
  ['structured-browser','structured-assessment-browser-smoke.mjs',['--retain-test-evidence']],
] : [
  ['learners','learner-assessment-integration.mjs',[]],
  ['structured','structured-assessment-integration.mjs',[]],
  ['assessments','assessment-integration.mjs',[]],
  ['foundation','db-integration.mjs',[]],
  ['administration','admin-integration.mjs',[]],
  ['files','files-integration.mjs',[]],
  ['lifecycle','lifecycle-integration.mjs',[]],
  ['concurrency','db-concurrency.mjs',[]],
]
for(const [name,script,args] of suites){
  console.log('START '+name)
  const start=new Date().toISOString(),log=createWriteStream(resolve(evidence,name+'.log'))
  const child=spawn(process.execPath,[resolve('scripts',script),...args],{env:{...process.env,SMOKE_EVIDENCE_DIR:resolve(evidence,name)},windowsHide:true,stdio:['ignore','pipe','pipe']})
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false})
  const code=await new Promise((done,reject)=>{child.on('error',reject);child.on('close',done)})
  await new Promise(done=>log.end(done))
  results.push({name,script,args,start,end:new Date().toISOString(),exitCode:code,result:code===0?'PASS':'FAIL'})
  writeFileSync(resolve(evidence,process.argv.includes('--browser')?'browser-regressions.json':'regressions.json'),JSON.stringify(results,null,2))
  console.log((code===0?'PASS ':'FAIL ')+name)
}
if(results.some(r=>r.exitCode!==0))process.exitCode=1
