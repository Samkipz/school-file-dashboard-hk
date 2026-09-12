import { describe,expect,it } from 'vitest'
import { validateUpload, metadata, MAX_FILE_SIZE } from '../../lib/domain/file-validation'
function form(bytes: string|Uint8Array= '%PDF-1.7\nexample',name='evidence.pdf',type='application/pdf') { const d=new FormData();d.set('file',new File([bytes],name,{type}));return d }
describe('private file validation',()=>{
 it('accepts PDF and sanitizes traversal and control characters',async()=>{const result=await validateUpload(form(undefined,'../../bad\r\nname.pdf'),false);expect(result.originalName).toBe('bad__name.pdf');expect(result.size).toBeGreaterThan(0)})
 it('stores supplied title, description and category',async()=>{const d=form();d.set('title',' My work ');d.set('description',' Evidence ');d.set('category','work');expect(await validateUpload(d,false)).toMatchObject({title:'My work',description:'Evidence',category:'work'})})
 it.each([['x','e.pdf','application/pdf'],['%PDF-1.7','e.png','image/png'],['<svg/>','e.svg','image/svg+xml'],['hello','e.html','text/html'],['%PDF-1.7','e.pdf','text/plain']])('rejects forged or unsupported %s %s',async(bytes,name,mime)=>{await expect(validateUpload(form(bytes,name,mime),false)).rejects.toThrow('INVALID_INPUT')})
 it('rejects PDF in general media',async()=>{await expect(validateUpload(form(),true)).rejects.toThrow('INVALID_INPUT')})
 it('rejects missing, empty and oversized files',async()=>{for(const d of [new FormData(),form(''),form(new Uint8Array(MAX_FILE_SIZE+1))])await expect(validateUpload(d,false)).rejects.toThrow('INVALID_INPUT')})
 it('rejects invalid metadata',()=>{for(const fields of [['','', 'general'],['title','','other'],['title','x'.repeat(1001),'work'],['x\n','','work']])expect(()=>metadata(...fields as [string,string,string])).toThrow('INVALID_INPUT')})
 it('accepts permitted image and video signatures',async()=>{for(const [bytes,name,type] of [[new Uint8Array([137,80,78,71,13,10,26,10]),'x.png','image/png'],[new Uint8Array([255,216,255]),'x.jpg','image/jpeg'],['RIFF0000WEBPdata','x.webp','image/webp'],['0000ftypisomdata','x.mp4','video/mp4']] as const)expect((await validateUpload(form(bytes,name,type),true)).mimeType).toBe(type)})
})
