// components/Footer.tsx

/* =========================================================================
 * 💡 勇気を出してこのファイルを開いたあなたへ！🎉
 * ここは画面の一番下（フッター）に表示される内容を編集する場所です。
 * 以下の説明を読めば、プログラミング未経験でも安全にデザインを変更できます。
 * 好きなように数値をいじって、あなただけのデザインを作ってみてください！
 * ========================================================================= */

export default function Footer() {
  return (
    // フッター全体の大枠（背景色や全体の余白などを決めています）
    <footer className="w-full bg-gray-100 py-6 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto">
      
      {/* space-y-6 は「上のブロックと下のブロックの隙間の広さ」です */}
      <div className="max-w-md mx-auto space-y-6">

        {/* --- クレジット（名前）部分 --- */}
        <div className="space-y-2">
          <p>
            Created by <span className="font-bold text-gray-700">作者の名前</span>
          </p>
          <p>
            Edited by <span className="font-bold text-gray-700">編集者の名前</span>
          </p>
        </div>

        {/* 
          =========================================================================
          🎮 【サンクスメッセージの設定】（ゲームのエンディング風！） 🎮
          
          文字のデザインは `className="..."` の中にある「英単語（クラス名）」で決まります。
          以下のリストを参考に、英単語を書き換えたり付け足したりして遊んでみてください！
          半角スペースで区切れば、複数の設定を同時にかけられます。
          
          🎨 1. 色を変える (text-カラー名-濃さ, または 16進数)
             - text-red-500   : 赤色
             - text-blue-600  : 青色
             - text-[#ff0000] : [ ]の中に「16進数カラーコード」を書くと好きな色に！
             （例: ピンクなら text-[#ff6699]、ゴールドなら text-[#ffd700]）
             
          📏 2. サイズを変える (text-サイズ, または ピクセル指定)
             - text-sm        : 少し小さめ
             - text-xl        : 大きめ
             - text-2xl       : もっと大きい
             - text-[20px]    : [ ]の中に具体的な数値(px)を書いて自由な大きさに！
             
          🔤 3. 書体（フォント）を変える
             - font-sans      : 普通のゴシック体（基本）
             - font-serif     : 明朝体（ちょっとオシャレ、小説風）
             - font-mono      : 等幅フォント（プログラミングや、レトロゲーム風！）
             
          💪 4. 太さを変える
             - font-normal    : 普通の太さ
             - font-bold      : 太字
             - font-black     : 極太！
             
          ↔️ 5. 文字の間隔を開ける（映画やゲームのエモい演出に！）
             - tracking-wide  : 少し開ける
             - tracking-widest: ガッツリ開ける
          =========================================================================
        */}
        
        {/* サンクスメッセージのブロック (border-t で上に薄い線を引いて区切っています) */}
        <div className="pt-6 border-t border-gray-300">
          
          {/* 1行目: 英語のメッセージ（レトロゲーム風に font-mono を設定） */}
          <p className="font-mono text-gray-800 text-[18px] font-bold tracking-widest mb-2">
            Thank you for playing
          </p>
          
          {/* 2行目: 日本語のメッセージ（少し色を変えて強調しています） */}
          <p className="font-sans text-[#ff6600] text-[14px] font-bold tracking-wide">
            使ってくれてありがとう
          </p>
          
        </div>

      </div>
    </footer>
  );
}
