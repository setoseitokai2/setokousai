// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="w-full bg-gray-100 py-6 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto">
      <div className="max-w-md mx-auto space-y-2">
        <p>
          Created by <span className="font-bold text-gray-700">作者の名前</span>
        </p>
        <p>
          Edited by <span className="font-bold text-gray-700">編集者の名前</span>
        </p>
        
        {/* メンバーを追加したい場合は、上の <p>〜</p> をコピーして下に貼り付けてください */}
      </div>
    </footer>
  );
}
