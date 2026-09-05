/**
 * Layout routa pro stránky DVPP zdarma: drží session přihlášeného učitele.
 */
import React from 'react';
import { Outlet } from 'react-router';
import { DvppSessionProvider } from './DvppSession';

export default function DvppRoot() {
  return (
    <DvppSessionProvider>
      <Outlet />
    </DvppSessionProvider>
  );
}
