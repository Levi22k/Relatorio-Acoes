import type { Metadata } from 'next';
import './globals.css';
import './visual.css';
export const metadata: Metadata = { title: 'Caderno de Ações', icons: {icon:'/favicon.svg'}, description: 'Cada ação, cada participante, cada abate. Seu histórico em um só lugar.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="pt-BR"><body>{children}</body></html>}
