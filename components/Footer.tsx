// components/Footer.tsx

/* =========================================================================
 * 💡 勇気を出してこのファイルを開いたあなたへ！🎉
 * ここは画面の一番下（フッター）に表示される内容を編集する場所です。
 * 以下の説明を読めば、プログラミング未経験でも安全にデザインを変更できます。
 * 好きなように数値をいじって、あなただけのデザインを作ってみてください！
 * ========================================================================= */

export default function Footer() {
  return (
    <footer className="w-full bg-gray-100 py-6 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto">
      
      {/* 修正: すべての要素をこの中央揃えの div の中に入れます */}
      <div className="max-w-md mx-auto space-y-6">
        
        {/* --- メッセージ部分 --- */}
        <div>
          {/* 1行目: メインメッセージ */}
          <p className="font-mono text-gray-800 text-[18px] font-bold tracking-widest mb-2">
            Thank you for using our app.
          </p>
          
          {/* 2行目: サブメッセージ */}
          <p className="font-sans text-[#ff6600] text-[14px] font-bold tracking-wide">
            Wishing you a great time! — The Developer
          </p>
        </div>

        {/* --- クレジット部分 (上に薄い線を引いて区切っています) --- */}
        <div className="pt-6 border-t border-gray-300 space-y-2">
          
          <p>
            制作年 <span className="font-bold text-gray-700">2026</span>
          </p>
          <p>
            所属組織 <span className="font-bold text-gray-700">岡山県立瀬戸高等学校 3年</span>
          </p>
          <p>
            制作者名 <span className="font-bold text-gray-700">恥ずかしいので伏せさせていただく☆</span>
          </p>

          {/* 隠しメッセージ（文字サイズを10pxに調整） */}
          <p className="font-sans text-gray-700 text-[10px] font-bold tracking-wide pt-4">
            製作者として何年使用しどの程度の効果を発揮するのかわからない。<br />
            多くの人を助けられることを切に願っている。<br />
            良い一日になりますように
          </p>

        </div>

        {/* 
          =========================================================================
          🎮 【サンクスメッセージの設定】 🎮
          
          文字のデザインは `className="..."` の中にある「英単語（クラス名）」で決まります。
          以下のリストを参考に、英単語を書き換えたり付け足したりして遊んでみてください！
          半角スペースで区切れば、複数の設定を同時にかけられます。
          
          🎨 1. 色を変える (text-カラー名-濃さ, または 16進数)
             - text-red-500   : 赤色
             - text-blue-600  : 青色
             - text-[#ff0000] : [ ]の中に「16進数カラーコード」を書くと好きな色に！
             
          📏 2. サイズを変える (text-サイズ, または ピクセル指定)
             - text-sm        : 少し小さめ
             - text-xl        : 大きめ
             - text-[20px]    : [ ]の中に具体的な数値(px)を書いて自由な大きさに！
             
          🔤 3. 書体（フォント）を変える
             - font-sans      : 普通のゴシック体（基本）
             - font-serif     : 明朝体（ちょっとオシャレ、小説風）
             - font-mono      : 等幅フォント（プログラミングや、レトロゲーム風！）
             
          💪 4. 太さを変える
             - font-normal    : 普通の太さ
             - font-bold      : 太字
             
          ↔️ 5. 文字の間隔を開ける（映画やゲームのエモい演出に！）
             - tracking-wide  : 少し開ける
             - tracking-widest: ガッツリ開ける
          =========================================================================
        */}
      </div>
    </footer>
  );
}


