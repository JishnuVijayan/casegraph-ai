import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExportPanel } from './ExportPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('previews authenticated HTML in a sandbox and clears it when a later read is denied',async()=>{
  const row={id:'synthetic-export',version:1,sha256:'synthetic-hash',createdAt:'2026-10-29T00:00:00Z'};
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({data:[row]})})
    .mockResolvedValueOnce({ok:true,text:async()=>'<h1>DRAFT</h1>'})
    .mockResolvedValueOnce({ok:false,status:403});
  vi.stubGlobal('fetch',fetch);
  render(<ExportPanel token="synthetic-token" caseId="synthetic-case" busy={false} perform={async(op)=>{try{await op();}catch{/* parent displays the error */}}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Refresh draft versions'}));
  fireEvent.click(await screen.findByRole('button',{name:'Review draft v1'}));
  const preview=await screen.findByTitle('Draft preview v1');
  expect(preview).toHaveAttribute('sandbox','');expect(preview).toHaveAttribute('srcdoc','<h1>DRAFT</h1>');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-token');
  fireEvent.click(screen.getByRole('button',{name:'Review draft v1'}));
  expect(screen.queryByTitle('Draft preview v1')).not.toBeInTheDocument();
});
