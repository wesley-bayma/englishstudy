'use client';

import React, { useEffect } from 'react';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { initDatabase } from '../lib/db';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <html lang="pt-BR">
      <head>
        <title>English Study Hub</title>
        <meta name="description" content="Organização e curadoria pessoal de vocabulário, frases e phrasal verbs para Anki" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
