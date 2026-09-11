import type { Metadata } from 'next'
import './globals.css'
import Footer from '../components/Footer' // ←【追加】作成したフッターを読み込む

export const metadata: Metadata = {
  title: '予約システム',
  description: 'Created for School Festival',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        {/* コンテンツ部分の最低限の高さを確保し、フッターを下に押し下げる */}
        <main className="min-h-screen">
          {children}
        </main>
        
        <Footer /> {/* ←【追加】全画面の最下部に表示 */}
      </body>
    </html>
  )
}
