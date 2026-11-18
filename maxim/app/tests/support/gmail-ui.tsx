import {createRoot} from 'react-dom/client';
import {GmailView} from '../../src/components/maxim/gmail';
import {WorkspaceApi} from '../../src/components/maxim/api';
import '../../src/app/globals.css';

const boot=document.getElementById('gmail-fixture')!;
const api=new WorkspaceApi(boot.dataset.csrf!,()=>{document.body.textContent='Fixture session expired';});
createRoot(boot).render(<GmailView api={api}/>);
