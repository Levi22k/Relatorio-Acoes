import {useEffect,useRef,useState} from 'react';

type DraftShape={imageUrl:string;participants:unknown[]};
type Snapshot<T>={version:1;draft:T;file:File|null};
// Separate from the shared database: drafts stay on this browser and account.
const database=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('caderno-action-drafts-v1',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
async function storage<T>(key:string,value?:Snapshot<T>|null):Promise<Snapshot<T>|undefined>{
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction('drafts',value===undefined?'readonly':'readwrite');
  const store=transaction.objectStore('drafts');
  const request=value===undefined?store.get(key):value===null?store.delete(key):store.put(value,key);
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onabort=()=>reject(transaction.error);
  transaction.onerror=()=>reject(transaction.error);
 });}finally{db.close()}
}
export function useActionDraft<T extends DraftShape>(owner:string){
 const key=location.pathname+':'+owner;
 const [draft,setDraft]=useState<T|null>(null),[file,setFile]=useState<File|null>(null);
 const [ready,setReady]=useState(false),[status,setStatus]=useState<'saving'|'saved'|'error'>('saving');
 const [restored,setRestored]=useState(false);
 const queue=useRef<Promise<unknown>>(Promise.resolve()),pending=useRef(0),revision=useRef(0);
 useEffect(()=>{let alive=true;storage<T>(key).then(saved=>{
  if(!alive)return;
  if(saved?.version===1&&saved.draft&&Array.isArray(saved.draft.participants)){
   const file=saved.file instanceof Blob?new File([saved.file],saved.file.name||'print.png',{type:saved.file.type}):null;
   setFile(file);setDraft({...saved.draft,imageUrl:file?URL.createObjectURL(file):saved.draft.imageUrl.startsWith('blob:')?'':saved.draft.imageUrl});setRestored(true);
  }
 }).catch(()=>{if(alive)setStatus('error')}).finally(()=>{if(alive)setReady(true)});
 return()=>{alive=false};},[key]);
 useEffect(()=>{
  if(!ready)return;
  const current=++revision.current;
  if(current===1&&!draft){setStatus(previous=>previous==='error'?'error':'saved');return}
  if(!draft)setRestored(false);
  pending.current++;setStatus('saving');
  const snapshot:Snapshot<T>|null=draft?{version:1,draft:{...draft,imageUrl:file?'':draft.imageUrl},file}:null;
  // Serialize saves so an older write cannot resurrect a canceled/saved draft.
  queue.current=queue.current.catch(()=>{}).then(()=>storage(key,snapshot)).then(()=>{
   if(current===revision.current)setStatus('saved');
  }).catch(()=>{if(current===revision.current)setStatus('error')}).finally(()=>{pending.current--});
 },[ready,key,draft,file]);
 useEffect(()=>{function leaving(event:BeforeUnloadEvent){if(pending.current>0||(draft&&status==='error')){event.preventDefault();event.returnValue=''}}
  window.addEventListener('beforeunload',leaving);return()=>window.removeEventListener('beforeunload',leaving);
 },[draft,status]);
 return {draft,setDraft,file,setFile,ready,status,restored};
}

