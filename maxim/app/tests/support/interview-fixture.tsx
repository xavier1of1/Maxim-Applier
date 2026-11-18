import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';
import {WorkspaceApi} from '../../src/components/maxim/api';
import {InterviewView} from '../../src/components/maxim/interview';
declare const __INTERVIEW_FIXTURE__:{csrf:string;job:{id:string;revision:number;company:string;title:string}|null};
const api=new WorkspaceApi(__INTERVIEW_FIXTURE__.csrf,()=>{document.body.textContent='Fixture session expired';});
createRoot(document.getElementById('root')!).render(<Theme theme={neutralTheme} mode="light"><InterviewView api={api} disabled={false} job={__INTERVIEW_FIXTURE__.job}/></Theme>);
