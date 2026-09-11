// components/Footer.tsx

/* =========================================================================
 * 💡 勇気を出してこのファイルを開いたあなたへ！
 * ここは画面の一番下（フッター）に表示される名前を編集する場所です。
 * 以下の説明を読めば、プログラミング未経験でも安全に編集できます。
 * GitHub上で直接「鉛筆マーク」を押して編集し、CommitするだけでOKです！
 * ========================================================================= */

export default function Footer() {
  return (
    // ↓ここはフッター全体のデザイン（背景色や余白など）を決めています。いじらなくて大丈夫です。
    <footer className="w-full bg-gray-100 py-6 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto">
      
      {/* space-y-2 は「行と行の間の隙間」を作る魔法の言葉です */}
      <div className="max-w-md mx-auto space-y-2">

        {/* 
          ▼ 【基本の編集方法】
          黒文字になっている「作者の名前」「編集者の名前」の部分だけを書き換えてください。
          
          ※注意: <span className="..."> の部分はデザイン設定なので消さないように！
          - font-bold : 文字を太くする
          - text-gray-700 : 文字を濃いグレー（700の濃さ）にする
        */}
        
        <p>
          Created by <span className="font-bold text-gray-700">作者の名前</span>
        </p>
        
        <p>
          Edited by <span className="font-bold text-gray-700">編集者の名前</span>
        </p>

        {/* 
          ▼ 【新しく人を追加したい場合】
          人を増やしたい時は、すぐ下の行の最初にある「{/*」と最後にある「* /}」を消して、
          「役割」と「名前」を書き換えてください。
          もっと増やしたい場合は、その行を丸ごとコピーして下にペーストすれば無限に増やせます！
        */}
        
        {/* <p>Special Thanks: <span className="font-bold text-gray-700">手伝ってくれた人の名前</span></p> */}

      </div>
    </footer>
  );
}
