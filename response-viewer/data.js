export const has=(value,key)=>value!==null&&typeof value==='object'&&Object.hasOwn(value,key);
export function parsed(value){if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return value;}}
export function object(value){const p=parsed(value);return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}
export function recordsFrom(root){
 const base=parsed(root);
 if(Array.isArray(base)&&base.length)return base.map((value,index)=>({value,path:`$[${index}]`}));
 for(const key of ['rows','data','responses','records'])if(Array.isArray(base?.[key])&&base[key].length)return base[key].map((value,index)=>({value,path:`$[${JSON.stringify(key)}][${index}]`}));
 return [{value:base,path:'$'}];
}
export function inspect(value){const row=object(value),payload=has(row,'payload')?object(row.payload):row,preRow=object(payload.pre_survey),pre=has(preRow,'payload')?object(preRow.payload):preRow;return {row,payload,preRow,pre};}
