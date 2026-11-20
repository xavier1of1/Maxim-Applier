import {invariant} from './errors';

export type ModelApi='responses'|'chat_completions';
export function validateModelId(model:string){
 invariant(model.length>0&&model.length<=120&&/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(model),
  'invalid_model_id','Enter the exact API model ID, without spaces, such as gpt-4.1-mini. Display names are not API IDs.',400);
 return model;
}
