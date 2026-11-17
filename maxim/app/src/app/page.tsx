import {Suspense} from 'react';
import {WorkspaceApp} from '../components/maxim/workspace';
import {WorkspaceLoading} from '../components/maxim/shared';

export default function Page() {
  return <Suspense fallback={<WorkspaceLoading />}><WorkspaceApp /></Suspense>;
}
